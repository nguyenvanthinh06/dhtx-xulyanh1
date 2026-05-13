#!/usr/bin/env python3
"""Move input images whose current OCR result is not automatically acceptable.

Without ground-truth labels this script can only prove machine-detectable
failures: no plate result, empty OCR text, invalid Vietnamese plate format, or a
runtime/API error. A syntactically valid but wrong plate still needs human
ground-truth to catch.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sys
from contextlib import redirect_stdout
from datetime import datetime
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.pipeline import LicensePlatePipeline  # noqa: E402


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def load_dotenv(path: Path = ROOT / ".env") -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def iter_images(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def normalize_plate(text: str) -> str:
    return re.sub(r"[^0-9A-Z]", "", text.upper())


def is_valid_vn_plate(text: str) -> bool:
    normalized = normalize_plate(text)
    match = re.match(r"^([0-9]{2})([A-Z]{1,2})([0-9]{4,6})$", normalized)
    if not match:
        return False

    _, letters, digits = match.groups()
    valid_letters = set("ABCDEFGHKLMNPSTUVXY")
    special_pairs = {"CD", "LD", "NN", "NG", "QT", "CV"}

    if len(letters) == 1:
        return letters in valid_letters and 4 <= len(digits) <= 5

    if len(letters) == 2:
        if letters in special_pairs:
            return len(digits) == 5
        return all(ch in valid_letters for ch in letters) and 4 <= len(digits) <= 5

    return False


def classify(results: list[dict]) -> tuple[str, str]:
    if not results:
        return "no_plate_detected", "Pipeline returned no plate result."

    texts = [item.get("text", "").strip() for item in results]
    if not any(texts):
        raw_texts = [item.get("raw_text", "") for item in results if item.get("raw_text")]
        note = "All OCR texts are empty."
        if raw_texts:
            note += " Rejected raw OCR: " + " | ".join(raw_texts)
        return "ocr_empty", note

    invalid_texts = [text for text in texts if text and not is_valid_vn_plate(text)]
    if invalid_texts:
        return "invalid_format", "Invalid OCR text(s): " + " | ".join(invalid_texts)

    return "ok", "At least one OCR text has a valid Vietnamese plate format."


def safe_destination(output_dir: Path, source: Path) -> Path:
    candidate = output_dir / source.name
    if not candidate.exists():
        return candidate

    stem = source.stem
    suffix = source.suffix
    index = 1
    while True:
        candidate = output_dir / f"{stem}__dup{index}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def ensure_safe_dirs(input_dir: Path, output_dir: Path) -> tuple[Path, Path]:
    input_dir = input_dir.resolve()
    output_dir = output_dir.resolve()
    root = ROOT.resolve()

    if not input_dir.is_dir():
        raise ValueError(f"Input dir does not exist: {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    for path in (input_dir, output_dir):
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise ValueError(f"Refusing to operate outside workspace: {path}") from exc

    if input_dir == output_dir:
        raise ValueError("Input and output directories must be different.")

    return input_dir, output_dir


def build_pipeline(args: argparse.Namespace) -> LicensePlatePipeline:
    return LicensePlatePipeline(
        plate_model_path=args.plate_model,
        char_model_path=args.char_model,
        char_conf=args.char_conf,
        ocr_engine=args.ocr_engine,
        detect_engine=args.detect_engine,
        roboflow_api_key=os.getenv("ROBOFLOW_API_KEY"),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        roboflow_timeout=args.timeout,
        fallback_ocr_engine=args.fallback,
        fallback_detect_engine=args.fallback_detect,
        final_fallback_ocr_engine=args.final_fallback,
        fallback_plate_model_path=args.fallback_plate_model,
        fallback_char_model_path=args.char_model,
    )


def write_report(rows: list[dict], report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "image",
        "status",
        "texts",
        "raw_texts",
        "scores",
        "boxes",
        "destination",
        "note",
    ]
    with report_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Move input images that fail automatic plate OCR checks.")
    parser.add_argument("--input-dir", default="input")
    parser.add_argument("--output-dir", default="input-not-detect-2")
    parser.add_argument("--report", default="docs/input_not_detect_2_move_report.csv")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
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
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv()

    input_dir, output_dir = ensure_safe_dirs(Path(args.input_dir), Path(args.output_dir))
    images = iter_images(input_dir)
    if args.limit is not None:
        images = images[: args.limit]

    pipeline = build_pipeline(args)
    rows: list[dict] = []
    moved = 0
    failed = 0

    for index, image_path in enumerate(images, start=1):
        print(f"[{index}/{len(images)}] {image_path}")
        try:
            if args.verbose:
                _, results = pipeline.process_image(str(image_path))
            else:
                with redirect_stdout(StringIO()):
                    _, results = pipeline.process_image(str(image_path))
            status, note = classify(results)
        except Exception as exc:  # noqa: BLE001 - keep batch moving.
            results = []
            status = "error"
            note = f"{type(exc).__name__}: {exc}"

        destination = ""
        if status != "ok":
            failed += 1
            destination_path = safe_destination(output_dir, image_path)
            destination = str(destination_path)
            if not args.dry_run:
                resolved_source = image_path.resolve()
                if resolved_source.parent != input_dir:
                    raise ValueError(f"Refusing to move unexpected path: {resolved_source}")
                shutil.move(str(resolved_source), str(destination_path))
                moved += 1
            print(f"  -> {status}; {'would move' if args.dry_run else 'moved'} to {destination}")
        else:
            texts = " | ".join(item.get("text", "") for item in results)
            print(f"  -> ok: {texts}")

        rows.append(
            {
                "image": str(image_path),
                "status": status,
                "texts": " | ".join(item.get("text", "") for item in results),
                "raw_texts": " | ".join(item.get("raw_text", "") for item in results),
                "scores": " | ".join(f"{float(item.get('score', 0.0)):.3f}" for item in results),
                "boxes": " | ".join(str(item.get("box", "")) for item in results),
                "destination": destination,
                "note": note,
            }
        )

    write_report(rows, Path(args.report))
    print(f"[DONE] checked={len(images)} failed={failed} moved={moved} dry_run={args.dry_run}")
    print(f"[DONE] report={args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
