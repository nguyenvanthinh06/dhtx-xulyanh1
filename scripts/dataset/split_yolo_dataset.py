#!/usr/bin/env python3
"""Copy anh + YOLO label vao cau truc train/val/test.

Dau vao phu hop voi labelImg khi save YOLO txt: moi anh co file .txt cung stem.
Neu da dien cot `split` trong ground-truth CSV, script se dung split do.
"""

from __future__ import annotations

import argparse
import csv
import random
import shutil
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def read_split_map(csv_path: Path) -> dict[str, str]:
    if not csv_path or not csv_path.is_file():
        return {}
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        return {
            row["image_path"]: row.get("split", "train") or "train"
            for row in csv.DictReader(f)
        }


def choose_split(rng: random.Random, train_ratio: float, val_ratio: float) -> str:
    value = rng.random()
    if value < train_ratio:
        return "train"
    if value < train_ratio + val_ratio:
        return "val"
    return "test"


def main() -> int:
    parser = argparse.ArgumentParser(description="Split labelImg YOLO annotations into YOLO dataset folders.")
    parser.add_argument("--images-dir", required=True, help="Folder anh da label")
    parser.add_argument("--labels-dir", default=None, help="Folder label .txt; mac dinh trung voi images-dir")
    parser.add_argument("--output-dir", required=True, help="VD: data/plate_detection hoac data/char_detection")
    parser.add_argument("--ground-truth", default=None, help="CSV co cot image_path,split")
    parser.add_argument("--train-ratio", type=float, default=0.8)
    parser.add_argument("--val-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    images_dir = Path(args.images_dir)
    labels_dir = Path(args.labels_dir) if args.labels_dir else images_dir
    output_dir = Path(args.output_dir)
    split_map = read_split_map(Path(args.ground_truth)) if args.ground_truth else {}
    rng = random.Random(args.seed)

    for split in ("train", "val", "test"):
        (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    images = sorted(path for path in images_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS)
    copied = 0
    missing_labels = []
    for image_path in images:
        label_path = labels_dir / f"{image_path.stem}.txt"
        if not label_path.is_file():
            missing_labels.append(image_path.as_posix())
            continue

        split = split_map.get(image_path.as_posix()) or choose_split(rng, args.train_ratio, args.val_ratio)
        if split not in {"train", "val", "test"}:
            split = "train"

        image_out = output_dir / "images" / split / image_path.name
        label_out = output_dir / "labels" / split / label_path.name
        image_out.parent.mkdir(parents=True, exist_ok=True)
        label_out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(image_path, image_out)
        shutil.copy2(label_path, label_out)
        copied += 1

    print(f"Copied {copied} image/label pairs to {output_dir}")
    if missing_labels:
        print(f"Warning: {len(missing_labels)} images missing label txt")
        for item in missing_labels[:20]:
            print(f"  - {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
