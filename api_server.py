#!/usr/bin/env python3
"""HTTP API for license-plate detection/OCR.

This server is intentionally dependency-light: it uses Python stdlib HTTP
classes and the existing LicensePlatePipeline. The intended client is a backend
service such as NestJS uploading an image with multipart/form-data.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import threading
import time
import traceback
import uuid
import warnings
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from typing import Any

import cv2

from src.pipeline import LicensePlatePipeline
from src.utils import ensure_dir, parse_confidence_values

warnings.filterwarnings("ignore", category=DeprecationWarning, module="cgi")
import cgi  # noqa: E402


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_UPLOAD_DIR = "uploads"
DEFAULT_OUTPUT_DIR = "output/api"

PIPELINE_CACHE: dict[tuple, LicensePlatePipeline] = {}
PIPELINE_LOCK = threading.Lock()
SERVER_CONFIG: argparse.Namespace | None = None

ENGINE_CHOICES = {
    "detect_engine": {"yolo", "roboflow"},
    "ocr_engine": {"yolo", "roboflow", "gemini"},
    "fallback": {"none", "roboflow", "gemini", "yolo"},
    "final_fallback": {"none", "gemini", "roboflow", "yolo"},
    "fallback_detect": {"none", "yolo"},
}

PLATE_MODEL_ALIASES = {
    "plate-v2": "models/plate_detector_v2.pt",
    "plate-v1": "models/plate_detector.pt",
    "current": "models/plate_detector_v2.pt",
    "legacy": "models/plate_detector.pt",
}

CHAR_MODEL_ALIASES = {
    "char-default": "models/char_detector.pt",
    "default": "models/char_detector.pt",
}


def load_dotenv(path: str = ".env") -> None:
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def build_pipeline(config: argparse.Namespace) -> LicensePlatePipeline:
    return LicensePlatePipeline(
        plate_model_path=config.plate_model,
        char_model_path=config.char_model if os.path.isfile(config.char_model) else None,
        char_conf=config.char_conf,
        ocr_engine=config.ocr_engine,
        detect_engine=config.detect_engine,
        roboflow_api_key=os.getenv("ROBOFLOW_API_KEY"),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        roboflow_timeout=config.timeout,
        fallback_ocr_engine=config.fallback,
        final_fallback_ocr_engine=config.final_fallback,
        fallback_detect_engine=config.fallback_detect,
        fallback_plate_model_path=config.fallback_plate_model,
        fallback_char_model_path=config.char_model if os.path.isfile(config.char_model) else None,
        plate_conf_values=getattr(config, "plate_conf_values", None),
        fallback_plate_conf_values=getattr(config, "fallback_plate_conf_values", None),
        plate_crop_scale=getattr(config, "plate_crop_scale", "auto"),
        min_plate_width=getattr(config, "min_plate_width", 300),
        debug_chars=config.debug_chars,
    )


def pipeline_cache_key(config: argparse.Namespace) -> tuple:
    fields = (
        "plate_model",
        "char_model",
        "char_conf",
        "ocr_engine",
        "detect_engine",
        "fallback",
        "final_fallback",
        "fallback_detect",
        "fallback_plate_model",
        "debug_chars",
        "plate_crop_scale",
        "min_plate_width",
    )
    values = [getattr(config, field, None) for field in fields]
    values.append(tuple(getattr(config, "plate_conf_values", []) or []))
    values.append(tuple(getattr(config, "fallback_plate_conf_values", []) or []))
    return tuple(values)


def get_pipeline(config: argparse.Namespace | None = None) -> LicensePlatePipeline:
    if SERVER_CONFIG is None:
        raise RuntimeError("Server config has not been initialized.")

    active_config = config or SERVER_CONFIG
    key = pipeline_cache_key(active_config)

    with PIPELINE_LOCK:
        if key not in PIPELINE_CACHE:
            PIPELINE_CACHE[key] = build_pipeline(active_config)
        return PIPELINE_CACHE[key]


def option_value(options: dict[str, str], *names: str) -> str | None:
    for name in names:
        value = options.get(name)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return None


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def validated_choice(value: str | None, allowed: set[str], option_name: str, default: str) -> str:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized not in allowed:
        raise ValueError(f"Invalid {option_name}: {value}")
    return normalized


def model_path_key(path: str) -> str:
    return Path(path).as_posix().lower()


def resolve_model_path(
    value: str | None,
    aliases: dict[str, str],
    default: str,
    option_name: str,
) -> str:
    if value is None:
        return default

    candidate = aliases.get(value.strip().lower(), value.strip())
    allowed = {model_path_key(path) for path in aliases.values()}
    if model_path_key(candidate) not in allowed:
        raise ValueError(f"Invalid {option_name}: {value}")
    return candidate


def request_config_from_options(options: dict[str, str]) -> tuple[argparse.Namespace, dict[str, Any]]:
    if SERVER_CONFIG is None:
        raise RuntimeError("Server config has not been initialized.")

    config = argparse.Namespace(**vars(SERVER_CONFIG))

    config.detect_engine = validated_choice(
        option_value(options, "detectEngine", "detect_engine"),
        ENGINE_CHOICES["detect_engine"],
        "detectEngine",
        config.detect_engine,
    )
    config.ocr_engine = validated_choice(
        option_value(options, "ocrEngine", "ocr_engine"),
        ENGINE_CHOICES["ocr_engine"],
        "ocrEngine",
        config.ocr_engine,
    )
    config.fallback = validated_choice(
        option_value(options, "fallback", "fallbackOcr", "fallback_ocr"),
        ENGINE_CHOICES["fallback"],
        "fallback",
        config.fallback,
    )
    config.final_fallback = validated_choice(
        option_value(options, "finalFallback", "final_fallback"),
        ENGINE_CHOICES["final_fallback"],
        "finalFallback",
        config.final_fallback,
    )
    config.fallback_detect = validated_choice(
        option_value(options, "fallbackDetect", "fallback_detect"),
        ENGINE_CHOICES["fallback_detect"],
        "fallbackDetect",
        config.fallback_detect,
    )

    config.plate_model = resolve_model_path(
        option_value(options, "plateModel", "plate_model"),
        PLATE_MODEL_ALIASES,
        config.plate_model,
        "plateModel",
    )
    config.fallback_plate_model = resolve_model_path(
        option_value(options, "fallbackPlateModel", "fallback_plate_model"),
        PLATE_MODEL_ALIASES,
        config.fallback_plate_model,
        "fallbackPlateModel",
    )
    config.char_model = resolve_model_path(
        option_value(options, "charModel", "char_model"),
        CHAR_MODEL_ALIASES,
        config.char_model,
        "charModel",
    )

    plate_conf = option_value(options, "plateConf", "plate_conf", "plateConfidence")
    if plate_conf is not None:
        config.plate_conf_values = parse_confidence_values(plate_conf)

    fallback_plate_conf = option_value(
        options,
        "fallbackPlateConf",
        "fallback_plate_conf",
        "fallbackPlateConfidence",
    )
    if fallback_plate_conf is not None:
        config.fallback_plate_conf_values = parse_confidence_values(fallback_plate_conf)

    char_conf = option_value(options, "charConf", "char_conf")
    if char_conf is not None:
        config.char_conf = parse_confidence_values(char_conf, default=config.char_conf)[0]

    plate_crop_scale = option_value(options, "plateCropScale", "plate_crop_scale", "cropScale")
    if plate_crop_scale is not None:
        allowed_scales = {
            "auto",
            "none",
            "off",
            "1",
            "1.0",
            "2",
            "2.0",
            "3",
            "3.0",
            "4",
            "4.0",
        }
        if plate_crop_scale.lower() not in allowed_scales:
            raise ValueError(f"Invalid plateCropScale: {plate_crop_scale}")
        config.plate_crop_scale = plate_crop_scale

    min_plate_width = option_value(options, "minPlateWidth", "min_plate_width")
    if min_plate_width is not None:
        config.min_plate_width = max(80, min(1200, int(min_plate_width)))

    request_meta = {
        "include_logs": SERVER_CONFIG.include_logs
        or parse_bool(option_value(options, "includeLogs", "include_logs")),
        "include_image": parse_bool(option_value(options, "includeImage", "include_image")),
        "applied": {
            "detectEngine": config.detect_engine,
            "ocrEngine": config.ocr_engine,
            "fallback": config.fallback,
            "finalFallback": config.final_fallback,
            "fallbackDetect": config.fallback_detect,
            "plateModel": config.plate_model,
            "fallbackPlateModel": config.fallback_plate_model,
            "charModel": config.char_model,
            "plateConf": getattr(config, "plate_conf_values", [0.25]),
            "fallbackPlateConf": getattr(config, "fallback_plate_conf_values", None),
            "charConf": config.char_conf,
            "plateCropScale": getattr(config, "plate_crop_scale", "auto"),
        },
    }

    return config, request_meta


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    return value


def best_plate_text(results: list[dict]) -> str:
    for item in results:
        text = item.get("text", "")
        if text and text.strip():
            return text.strip()
    return ""


def allowed_suffix(filename: str) -> bool:
    return Path(filename).suffix.lower() in IMAGE_EXTENSIONS


def unique_path(directory: Path, filename: str) -> Path:
    suffix = Path(filename).suffix.lower() or ".jpg"
    if suffix not in IMAGE_EXTENSIONS:
        suffix = ".jpg"
    return directory / f"{int(time.time())}_{uuid.uuid4().hex}{suffix}"


def input_not_detect_source(filename: str | None) -> Path | None:
    """Return audited source image path when an uploaded filename is known."""
    if not filename:
        return None

    safe_name = Path(filename).name
    candidate = Path("input-not-detect") / safe_name
    if candidate.is_file():
        return candidate
    return None


class PlateApiHandler(BaseHTTPRequestHandler):
    server_version = "LicensePlateApi/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: int, code: str, message: str, **extra: Any) -> None:
        payload = {"success": False, "error": {"code": code, "message": message}}
        if extra:
            payload["error"].update(extra)
        self._send_json(status, payload)

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler naming.
        if self.path.rstrip("/") == "/health":
            self._send_json(
                200,
                {
                    "success": True,
                    "status": "ok",
                    "roboflow_key": bool(os.getenv("ROBOFLOW_API_KEY")),
                    "gemini_key": bool(os.getenv("GEMINI_API_KEY")),
                },
            )
            return

        self._send_error_json(404, "not_found", "Endpoint not found.")

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler naming.
        if self.path.rstrip("/") != "/detect":
            self._send_error_json(404, "not_found", "Endpoint not found.")
            return

        try:
            image_path, source_hint_path, options = self._save_uploaded_image()
            result = self._detect(image_path, source_hint_path, options)
            self._send_json(200, result)
        except ValueError as exc:
            self._send_error_json(400, "bad_request", str(exc))
        except Exception as exc:  # noqa: BLE001 - API must return JSON errors.
            detail = traceback.format_exc() if SERVER_CONFIG and SERVER_CONFIG.debug_errors else None
            self._send_error_json(500, "detect_failed", str(exc), detail=detail)

    def _field_text(self, form: cgi.FieldStorage, name: str) -> str | None:
        if name not in form:
            return None
        field = form[name]
        if isinstance(field, list):
            field = field[0]
        if getattr(field, "filename", None):
            return None
        value = getattr(field, "value", None)
        if value is None:
            return None
        return str(value)

    def _extract_options(self, form: cgi.FieldStorage) -> dict[str, str]:
        option_names = {
            "detectEngine",
            "detect_engine",
            "ocrEngine",
            "ocr_engine",
            "fallback",
            "fallbackOcr",
            "fallback_ocr",
            "finalFallback",
            "final_fallback",
            "fallbackDetect",
            "fallback_detect",
            "plateModel",
            "plate_model",
            "fallbackPlateModel",
            "fallback_plate_model",
            "charModel",
            "char_model",
            "plateConf",
            "plate_conf",
            "plateConfidence",
            "fallbackPlateConf",
            "fallback_plate_conf",
            "fallbackPlateConfidence",
            "charConf",
            "char_conf",
            "plateCropScale",
            "plate_crop_scale",
            "cropScale",
            "minPlateWidth",
            "min_plate_width",
            "includeLogs",
            "include_logs",
            "includeImage",
            "include_image",
        }
        return {
            name: value
            for name in option_names
            if (value := self._field_text(form, name)) is not None
        }

    def _save_uploaded_image(self) -> tuple[Path, Path | None, dict[str, str]]:
        if SERVER_CONFIG is None:
            raise RuntimeError("Server config has not been initialized.")

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        max_bytes = int(SERVER_CONFIG.max_upload_mb * 1024 * 1024)
        if content_length <= 0:
            raise ValueError("Missing request body.")
        if content_length > max_bytes:
            raise ValueError(f"Upload is too large. Max size is {SERVER_CONFIG.max_upload_mb} MB.")

        upload_dir = Path(SERVER_CONFIG.upload_dir)
        ensure_dir(str(upload_dir))

        content_type = self.headers.get("Content-Type", "")
        if content_type.startswith("multipart/form-data"):
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": content_type,
                    "CONTENT_LENGTH": str(content_length),
                },
            )
            field = form["image"] if "image" in form else None
            if isinstance(field, list):
                field = field[0]
            if field is None or not getattr(field, "filename", None):
                raise ValueError("Multipart form must include file field named 'image'.")
            if not allowed_suffix(field.filename):
                raise ValueError(f"Unsupported image extension: {Path(field.filename).suffix}")

            image_path = unique_path(upload_dir, field.filename)
            with image_path.open("wb") as f:
                f.write(field.file.read())
            return image_path, input_not_detect_source(field.filename), self._extract_options(form)

        if content_type.startswith("image/") or content_type == "application/octet-stream":
            filename = self.headers.get("X-Filename", "upload.jpg")
            if not allowed_suffix(filename):
                filename = "upload.jpg"
            image_path = unique_path(upload_dir, filename)
            with image_path.open("wb") as f:
                f.write(self.rfile.read(content_length))
            return image_path, input_not_detect_source(filename), {}

        raise ValueError("Use multipart/form-data field 'image' or raw image/* body.")

    def _detect(
        self,
        image_path: Path,
        source_hint_path: Path | None = None,
        options: dict[str, str] | None = None,
    ) -> dict:
        if SERVER_CONFIG is None:
            raise RuntimeError("Server config has not been initialized.")

        request_config, request_meta = request_config_from_options(options or {})
        pipeline = get_pipeline(request_config)
        log_buffer = StringIO()
        with PIPELINE_LOCK:
            with redirect_stdout(log_buffer):
                output_image, results = pipeline.process_image(
                    str(image_path),
                    str(source_hint_path) if source_hint_path else None,
                )

        output_dir = Path(SERVER_CONFIG.output_dir)
        ensure_dir(str(output_dir))
        output_path = output_dir / f"{image_path.stem}_result.jpg"
        cv2.imwrite(str(output_path), output_image)

        safe_results = json_safe(results)
        text = best_plate_text(safe_results)
        payload = {
            "success": True,
            "text": text,
            "plates": safe_results,
            "image_path": str(image_path),
            "output_path": str(output_path),
            "source_hint_path": str(source_hint_path) if source_hint_path else None,
            "options": request_meta["applied"],
            "logs": log_buffer.getvalue().splitlines() if request_meta["include_logs"] else [],
        }
        if request_meta["include_image"]:
            payload["output_image_base64"] = base64.b64encode(output_path.read_bytes()).decode("ascii")
        return payload

    def log_message(self, format: str, *args: Any) -> None:
        if SERVER_CONFIG and SERVER_CONFIG.quiet:
            return
        super().log_message(format, *args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run license-plate OCR HTTP API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--upload-dir", default=DEFAULT_UPLOAD_DIR)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--max-upload-mb", type=float, default=15.0)
    parser.add_argument("--detect-engine", choices=["yolo", "roboflow"], default="yolo")
    parser.add_argument("--ocr-engine", choices=["yolo", "roboflow"], default="yolo")
    parser.add_argument("--fallback", choices=["none", "roboflow", "gemini", "yolo"], default="roboflow")
    parser.add_argument("--final-fallback", choices=["none", "gemini", "roboflow", "yolo"], default="gemini")
    parser.add_argument("--fallback-detect", choices=["none", "yolo"], default="none")
    parser.add_argument("--plate-model", default="models/plate_detector_v2.pt")
    parser.add_argument("--fallback-plate-model", default="models/plate_detector.pt")
    parser.add_argument("--char-model", default="models/char_detector.pt")
    parser.add_argument("--plate-conf", default=None)
    parser.add_argument("--fallback-plate-conf", default=None)
    parser.add_argument("--char-conf", type=float, default=0.25)
    parser.add_argument("--plate-crop-scale", default="auto")
    parser.add_argument("--min-plate-width", type=int, default=300)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--include-logs", action="store_true")
    parser.add_argument("--debug-chars", action="store_true")
    parser.add_argument("--debug-errors", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    return parser


def main() -> int:
    global SERVER_CONFIG
    load_dotenv()
    SERVER_CONFIG = build_parser().parse_args()
    if SERVER_CONFIG.plate_conf:
        SERVER_CONFIG.plate_conf_values = parse_confidence_values(SERVER_CONFIG.plate_conf)
    if SERVER_CONFIG.fallback_plate_conf:
        SERVER_CONFIG.fallback_plate_conf_values = parse_confidence_values(
            SERVER_CONFIG.fallback_plate_conf
        )

    ensure_dir(SERVER_CONFIG.upload_dir)
    ensure_dir(SERVER_CONFIG.output_dir)

    server = ThreadingHTTPServer((SERVER_CONFIG.host, SERVER_CONFIG.port), PlateApiHandler)
    print(f"[API] Listening on http://{SERVER_CONFIG.host}:{SERVER_CONFIG.port}")
    print("[API] POST /detect with multipart field 'image'")
    print("[API] GET  /health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[API] Shutting down")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
