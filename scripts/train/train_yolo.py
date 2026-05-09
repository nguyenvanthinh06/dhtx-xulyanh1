#!/usr/bin/env python3
"""Train YOLO tu config YAML trong config/train/*.yaml."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import yaml


ALLOWED_KEYS = ["model", "data", "imgsz", "epochs", "batch", "project", "name"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ultralytics YOLO training from a YAML config.")
    parser.add_argument("--config", required=True, help="VD: config/train/plate_yolo.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Chi in command, khong train")
    args = parser.parse_args()

    config_path = Path(args.config)
    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    command = ["yolo", "detect", "train"]
    for key in ALLOWED_KEYS:
        if key in cfg and cfg[key] is not None:
            command.append(f"{key}={cfg[key]}")

    print(" ".join(command))
    if args.dry_run:
        return 0
    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
