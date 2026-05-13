#!/usr/bin/env python3
"""HTTP API for license-plate detection/OCR.

This server is intentionally dependency-light: it uses Python stdlib HTTP
classes and the existing LicensePlatePipeline. The intended client is a backend
service such as NestJS uploading an image with multipart/form-data.
"""

from __future__ import annotations

import argparse
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
from src.utils import ensure_dir

warnings.filterwarnings("ignore", category=DeprecationWarning, module="cgi")
import cgi  # noqa: E402


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DEFAULT_UPLOAD_DIR = "uploads"
DEFAULT_OUTPUT_DIR = "output/api"

PIPELINE = None
PIPELINE_LOCK = threading.Lock()
SERVER_CONFIG: argparse.Namespace | None = None


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
        debug_chars=config.debug_chars,
    )


def get_pipeline() -> LicensePlatePipeline:
    global PIPELINE
    if SERVER_CONFIG is None:
        raise RuntimeError("Server config has not been initialized.")

    if PIPELINE is None:
        with PIPELINE_LOCK:
            if PIPELINE is None:
                PIPELINE = build_pipeline(SERVER_CONFIG)
    return PIPELINE


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
            image_path = self._save_uploaded_image()
            result = self._detect(image_path)
            self._send_json(200, result)
        except ValueError as exc:
            self._send_error_json(400, "bad_request", str(exc))
        except Exception as exc:  # noqa: BLE001 - API must return JSON errors.
            detail = traceback.format_exc() if SERVER_CONFIG and SERVER_CONFIG.debug_errors else None
            self._send_error_json(500, "detect_failed", str(exc), detail=detail)

    def _save_uploaded_image(self) -> Path:
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
            if field is None or not getattr(field, "filename", None):
                raise ValueError("Multipart form must include file field named 'image'.")
            if not allowed_suffix(field.filename):
                raise ValueError(f"Unsupported image extension: {Path(field.filename).suffix}")

            image_path = unique_path(upload_dir, field.filename)
            with image_path.open("wb") as f:
                f.write(field.file.read())
            return image_path

        if content_type.startswith("image/") or content_type == "application/octet-stream":
            filename = self.headers.get("X-Filename", "upload.jpg")
            if not allowed_suffix(filename):
                filename = "upload.jpg"
            image_path = unique_path(upload_dir, filename)
            with image_path.open("wb") as f:
                f.write(self.rfile.read(content_length))
            return image_path

        raise ValueError("Use multipart/form-data field 'image' or raw image/* body.")

    def _detect(self, image_path: Path) -> dict:
        if SERVER_CONFIG is None:
            raise RuntimeError("Server config has not been initialized.")

        pipeline = get_pipeline()
        log_buffer = StringIO()
        with PIPELINE_LOCK:
            with redirect_stdout(log_buffer):
                output_image, results = pipeline.process_image(str(image_path))

        output_dir = Path(SERVER_CONFIG.output_dir)
        ensure_dir(str(output_dir))
        output_path = output_dir / f"{image_path.stem}_result.jpg"
        cv2.imwrite(str(output_path), output_image)

        safe_results = json_safe(results)
        text = best_plate_text(safe_results)
        return {
            "success": True,
            "text": text,
            "plates": safe_results,
            "image_path": str(image_path),
            "output_path": str(output_path),
            "logs": log_buffer.getvalue().splitlines() if SERVER_CONFIG.include_logs else [],
        }

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
    parser.add_argument("--char-conf", type=float, default=0.25)
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--include-logs", action="store_true")
    parser.add_argument("--debug-chars", action="store_true")
    parser.add_argument("--debug-errors", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    return parser


def main() -> int:
    global SERVER_CONFIG
    load_dotenv()
    SERVER_CONFIG = build_parser().parse_args()

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
