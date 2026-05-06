#!/usr/bin/env python3
"""Batch audit license-plate detection/OCR results for an image folder.

The script is intentionally conservative: it can prove that an image is broken
when no plate is detected, OCR returns empty text, or the OCR text does not match
basic Vietnamese license-plate syntax. It cannot prove that a syntactically valid
plate is the true plate unless you add human ground-truth labels.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from contextlib import redirect_stdout
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Iterable

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VN_PLATE_RE = re.compile(r"^[0-9]{2}[A-Z]{1,2}-?[0-9]{4,5}$")


def load_dotenv(path: Path = Path(".env")) -> None:
    """Load simple KEY=VALUE pairs without printing secrets."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def iter_images(input_dir: Path) -> Iterable[Path]:
    return sorted(
        path for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def sanitize_plate(text: str) -> str:
    return re.sub(r"[^0-9A-Z]", "", text.upper())


def is_valid_vn_plate(text: str) -> bool:
    text = text.strip().upper()
    return bool(VN_PLATE_RE.match(text) or VN_PLATE_RE.match(sanitize_plate(text)))


def classify_results(results: list[dict], min_score: float) -> tuple[str, str]:
    if not results:
        return "no_plate_detected", "Không detect được vùng biển số."

    statuses: list[str] = []
    notes: list[str] = []

    empty_texts = [item for item in results if not item.get("text", "").strip()]
    invalid_texts = [
        item for item in results
        if item.get("text", "").strip() and not is_valid_vn_plate(item.get("text", ""))
    ]
    low_scores = [item for item in results if float(item.get("score", 0.0)) < min_score]

    if empty_texts:
        statuses.append("ocr_empty")
        notes.append(f"{len(empty_texts)} biển số có OCR rỗng.")
    if invalid_texts:
        statuses.append("invalid_format")
        notes.append(
            "OCR không khớp format biển Việt Nam: "
            + ", ".join(item.get("text", "") for item in invalid_texts)
        )
    if low_scores:
        statuses.append("low_plate_confidence")
        notes.append(f"{len(low_scores)} vùng biển có confidence detect thấp hơn {min_score:.2f}.")

    if not statuses:
        statuses.append("ok")
        notes.append("Detect/OCR có format hợp lệ; vẫn cần ground-truth để biết có sai digit/chữ hay không.")

    return ";".join(statuses), " ".join(notes)


def process_with_pipeline(args: argparse.Namespace, image_path: Path) -> list[dict]:
    from src.pipeline import LicensePlatePipeline

    pipeline = LicensePlatePipeline(
        plate_model_path=args.plate_model,
        char_model_path=args.char_model,
        plate_conf=args.plate_conf,
        char_conf=args.char_conf,
        config_path=args.config,
        ocr_engine=args.ocr_engine,
        detect_engine=args.detect_engine,
        roboflow_api_key=args.roboflow_api_key or os.getenv("ROBOFLOW_API_KEY"),
        roboflow_model_id=args.roboflow_model_id,
        roboflow_detect_model_id=args.roboflow_detect_model_id,
        roboflow_api_url=args.roboflow_api_url,
        roboflow_timeout=args.roboflow_timeout,
    )
    _, results = pipeline.process_image(str(image_path))
    return results


def process_detect_only(args: argparse.Namespace, image_path: Path) -> list[dict]:
    import cv2

    from src.detector import PlateDetector

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("Cannot read image")

    detector = PlateDetector(
        model_path=args.plate_model,
        conf=args.plate_conf,
        engine=args.detect_engine,
        roboflow_api_key=args.roboflow_api_key or os.getenv("ROBOFLOW_API_KEY"),
        roboflow_model_id=args.roboflow_detect_model_id,
        roboflow_api_url=args.roboflow_api_url,
        roboflow_timeout=args.roboflow_timeout,
    )
    plates = detector.detect(image)
    return [{"box": plate["box"], "score": plate["score"], "text": ""} for plate in plates]


def row_from_result(image_path: Path, results: list[dict], status: str, notes: str) -> dict:
    return {
        "image": str(image_path),
        "status": status,
        "plates_detected": len(results),
        "texts": " | ".join(item.get("text", "") for item in results),
        "scores": " | ".join(f"{float(item.get('score', 0.0)):.3f}" for item in results),
        "boxes": " | ".join(str(item.get("box", "")) for item in results),
        "notes": notes,
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["image", "status", "plates_detected", "texts", "scores", "boxes", "notes"]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, rows: list[dict], args: argparse.Namespace, command: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    total = len(rows)
    counts: dict[str, int] = {}
    for row in rows:
        for status in row["status"].split(";"):
            counts[status] = counts.get(status, 0) + 1

    problem_rows = [row for row in rows if row["status"] != "ok"]
    lines = [
        "# Báo cáo audit ảnh input",
        "",
        f"- Thời điểm chạy: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        f"- Lệnh: `{command}`",
        f"- Folder input: `{args.input_dir}`",
        f"- Detect engine: `{args.detect_engine}`",
        f"- OCR engine: `{args.ocr_engine}`",
        f"- Tổng ảnh kiểm tra: **{total}**",
        "",
        "## Thống kê trạng thái",
        "",
    ]
    for status, count in sorted(counts.items()):
        lines.append(f"- `{status}`: **{count}**")

    lines.extend([
        "",
        "## Danh sách ảnh cần xử lý lại",
        "",
        "| Ảnh | Trạng thái | Text OCR | Score | Ghi chú |",
        "| --- | --- | --- | --- | --- |",
    ])
    for row in problem_rows:
        lines.append(
            f"| `{row['image']}` | `{row['status']}` | `{row['texts']}` | "
            f"`{row['scores']}` | {row['notes']} |"
        )

    lines.extend([
        "",
        "## Cách hiểu kết quả",
        "",
        "- `no_plate_detected`: model không tìm thấy vùng biển số.",
        "- `ocr_empty`: đã có vùng biển nhưng OCR không ra ký tự.",
        "- `invalid_format`: OCR có text nhưng không khớp cú pháp biển số Việt Nam cơ bản.",
        "- `low_plate_confidence`: vùng biển số có confidence thấp hơn ngưỡng audit.",
        "- `ok`: text khớp cú pháp; muốn kết luận đúng/sai tuyệt đối cần thêm file ground-truth do người gán nhãn.",
        "",
        "## Phương án cải thiện để detect hết bộ ảnh hiện có",
        "",
        "1. Chạy audit nhiều ngưỡng `--plate-conf`/`--char-conf` (ví dụ 0.25, 0.15, 0.10), sau đó ưu tiên review nhóm `no_plate_detected`, `ocr_empty`, `invalid_format`.",
        "2. Với ảnh không detect vùng biển: thử Roboflow detector, hoặc train/fine-tune thêm local YOLO bằng chính các ảnh fail, có augmentation cho biển nghiêng, mờ, thiếu sáng, xa camera.",
        "3. Với OCR rỗng/sai format: crop vùng biển rộng hơn, upscale crop nhỏ, hạ `--char-conf`, và bổ sung dữ liệu OCR cho font/ký tự Việt Nam hay nhầm như A/4, B/8, D/0, G/6, S/5.",
        "4. Thêm bước hậu kiểm regex + rule biển số Việt Nam để tự flag kết quả đáng nghi thay vì chấp nhận mọi OCR fallback.",
        "5. Tạo ground-truth CSV (`image,expected_plate`) rồi so sánh exact-match để biết biển nào sai thật sự, kể cả trường hợp OCR ra format hợp lệ nhưng nhầm một chữ/số.",
    ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit all images in input folder for license-plate detect/OCR failures.")
    parser.add_argument("--input-dir", default="input", help="Folder chứa ảnh cần kiểm tra")
    parser.add_argument("--csv", default="docs/input_audit_results.csv", help="File CSV kết quả chi tiết")
    parser.add_argument("--report", default="docs/input_audit_report.md", help="File Markdown tổng hợp")
    parser.add_argument("--limit", type=int, default=None, help="Giới hạn số ảnh để smoke test")
    parser.add_argument("--detect-engine", choices=["roboflow", "yolo"], default="roboflow")
    parser.add_argument("--ocr-engine", choices=["roboflow", "yolo", "none"], default="roboflow")
    parser.add_argument("--plate-model", default="models/plate_detector.pt")
    parser.add_argument("--char-model", default=None)
    parser.add_argument("--plate-conf", type=float, default=0.25)
    parser.add_argument("--char-conf", type=float, default=0.25)
    parser.add_argument("--min-audit-score", type=float, default=0.35)
    parser.add_argument("--config", default="config/plate_rules.yaml")
    parser.add_argument("--roboflow-api-key", default=None)
    parser.add_argument("--roboflow-model-id", default="license-plate-ocr-hugcj/3")
    parser.add_argument("--roboflow-detect-model-id", default="license-plate-recognition-rxg4e/4")
    parser.add_argument("--roboflow-api-url", default="https://detect.roboflow.com")
    parser.add_argument("--roboflow-timeout", type=float, default=30.0)
    parser.add_argument("--verbose", action="store_true", help="In log chi tiết của pipeline")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_dotenv()

    input_dir = Path(args.input_dir)
    if not input_dir.is_dir():
        print(f"[ERROR] Input folder không tồn tại: {input_dir}", file=sys.stderr)
        return 2

    images = list(iter_images(input_dir))
    if args.limit is not None:
        images = images[:args.limit]

    if args.ocr_engine == "none":
        runner = process_detect_only
    else:
        runner = process_with_pipeline

    rows: list[dict] = []
    for idx, image_path in enumerate(images, start=1):
        print(f"[{idx}/{len(images)}] {image_path}")
        try:
            if args.verbose:
                results = runner(args, image_path)
            else:
                with redirect_stdout(StringIO()):
                    results = runner(args, image_path)
            status, notes = classify_results(results, args.min_audit_score)
        except Exception as exc:  # noqa: BLE001 - audit must continue across bad files/network errors.
            results = []
            status = "error"
            notes = f"{type(exc).__name__}: {exc}"
        rows.append(row_from_result(image_path, results, status, notes))

    write_csv(Path(args.csv), rows)
    write_markdown(Path(args.report), rows, args, " ".join(sys.argv))
    print(f"[DONE] CSV: {args.csv}")
    print(f"[DONE] Report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
