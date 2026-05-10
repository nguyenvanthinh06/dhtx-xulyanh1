#!/usr/bin/env python3
"""Train YOLO từ config YAML trong config/train/*.yaml sử dụng Ultralytics Python API."""

from __future__ import annotations

import argparse
from pathlib import Path
import yaml
from ultralytics import YOLO


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ultralytics YOLO training from a YAML config.")
    parser.add_argument("--config", required=True, help="VD: config/train/plate_yolo.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ in thông số, không train")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Lỗi: Không tìm thấy file config tại {config_path}")
        return 1

    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    
    model_path = cfg.get("model", "yolov8n.pt")
    print(f"--- Khởi tạo model: {model_path} ---")
    
    if args.dry_run:
        print("Cấu hình sẽ chạy:")
        for k, v in cfg.items():
            print(f"  {k}: {v}")
        return 0

    # Khởi tạo model
    model = YOLO(model_path)

    # Lọc các tham số hợp lệ cho hàm train()
    # Chuyển đổi path về dạng absolute để tránh lỗi tìm file
    train_args = {
        "data": str(Path(cfg.get("data")).absolute()) if cfg.get("data") else None,
        "imgsz": cfg.get("imgsz", 640),
        "epochs": cfg.get("epochs", 100),
        "batch": cfg.get("batch", 16),
        "project": cfg.get("project", "runs/detect"),
        "name": cfg.get("name", "exp"),
    }

    print(f"--- Bắt đầu huấn luyện với data: {train_args['data']} ---")
    
    try:
        model.train(**train_args)
        return 0
    except Exception as e:
        print(f"Lỗi khi huấn luyện: {e}")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
