#!/usr/bin/env python3
"""Tao file ground-truth CSV tu folder anh hard-case.

CSV nay la danh sach can nguoi review dien `plate_text`, `issue_type`,
`plate_type`. Script khong goi model/API, chi liet ke anh de bat dau gan nhan.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
FIELDS = ["image_path", "plate_text", "issue_type", "plate_type", "split", "note"]


def iter_images(input_dir: Path):
    return sorted(
        path for path in input_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def load_existing(output_path: Path) -> dict[str, dict[str, str]]:
    if not output_path.is_file():
        return {}
    with output_path.open("r", encoding="utf-8", newline="") as f:
        return {row["image_path"]: row for row in csv.DictReader(f)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build ground-truth CSV template for input-not-detect images.")
    parser.add_argument("--input-dir", default="input-not-detect", help="Folder anh hard-case")
    parser.add_argument("--output", default="data/ground_truth/input_not_detect.csv", help="CSV output")
    parser.add_argument("--default-split", default="train", choices=["train", "val", "test"])
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output)
    if not input_dir.is_dir():
        raise SystemExit(f"Input folder khong ton tai: {input_dir}")

    existing = load_existing(output_path)
    rows = []
    for image_path in iter_images(input_dir):
        key = image_path.as_posix()
        row = existing.get(key, {})
        rows.append({
            "image_path": key,
            "plate_text": row.get("plate_text", ""),
            "issue_type": row.get("issue_type", ""),
            "plate_type": row.get("plate_type", ""),
            "split": row.get("split", args.default_split),
            "note": row.get("note", ""),
        })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
