#!/usr/bin/env python3
"""Crop bien so tu dataset YOLO plate_detection de tao anh label OCR ky tu.

Sau khi crop, mo `data/char_detection/raw_crops` bang labelImg va label tung ky tu
(theo file data/labelimg_classes/char_classes.txt). Khong label dau '-' hoac '.'.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def yolo_to_xyxy(line: str, width: int, height: int, padding: int):
    cls_id, xc, yc, bw, bh = line.split()[:5]
    xc, yc, bw, bh = map(float, (xc, yc, bw, bh))
    x1 = int((xc - bw / 2) * width) - padding
    y1 = int((yc - bh / 2) * height) - padding
    x2 = int((xc + bw / 2) * width) + padding
    y2 = int((yc + bh / 2) * height) + padding
    return max(0, x1), max(0, y1), min(width, x2), min(height, y2), cls_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Crop plate boxes from YOLO labels.")
    parser.add_argument("--dataset-dir", default="data/plate_detection")
    parser.add_argument("--split", default="train", choices=["train", "val", "test"])
    parser.add_argument("--output-dir", default="data/char_detection/raw_crops")
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--manifest", default="data/char_detection/raw_crops_manifest.csv")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    images_dir = dataset_dir / "images" / args.split
    labels_dir = dataset_dir / "labels" / args.split
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not images_dir.is_dir() or not labels_dir.is_dir():
        print(f"Warning: missing images/labels folder for split '{args.split}': {images_dir}, {labels_dir}")
        images = []
    else:
        images = sorted(path for path in images_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)

    rows = []
    if not images:
        manifest = Path(args.manifest)
        manifest.parent.mkdir(parents=True, exist_ok=True)
        with manifest.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["crop_path", "source_image", "source_label", "box", "plate_text"])
            writer.writeheader()
        print(f"Wrote 0 crops to {output_dir}")
        print(f"Manifest: {manifest}")
        return 0

    import cv2

    for image_path in images:
        label_path = labels_dir / f"{image_path.stem}.txt"
        if not label_path.is_file():
            continue
        image = cv2.imread(str(image_path))
        if image is None:
            continue
        h, w = image.shape[:2]
        for index, line in enumerate(label_path.read_text(encoding="utf-8").splitlines()):
            if not line.strip():
                continue
            x1, y1, x2, y2, cls_id = yolo_to_xyxy(line, w, h, args.padding)
            crop = image[y1:y2, x1:x2]
            if crop.size == 0:
                continue
            out_path = output_dir / f"{image_path.stem}_plate{index}{image_path.suffix.lower()}"
            cv2.imwrite(str(out_path), crop)
            rows.append({
                "crop_path": out_path.as_posix(),
                "source_image": image_path.as_posix(),
                "source_label": label_path.as_posix(),
                "box": f"{x1},{y1},{x2},{y2}",
                "plate_text": "",
            })

    manifest = Path(args.manifest)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["crop_path", "source_image", "source_label", "box", "plate_text"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} crops to {output_dir}")
    print(f"Manifest: {manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
