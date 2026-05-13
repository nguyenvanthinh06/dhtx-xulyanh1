# === Module: main.py ===
# Entry point chinh cua chuong trinh License Plate OCR.
#
# Flow:
# Anh xe -> Detect bien so (YOLO/Roboflow) -> crop -> Roboflow OCR -> sort -> text

import argparse
import cv2
import os
from pathlib import Path

from src.pipeline import LicensePlatePipeline
from src.utils import ensure_dir, parse_confidence_values


def load_dotenv(path: str = ".env"):
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="License Plate OCR Pipeline")

    # --- Tham so dau vao/ra ---
    parser.add_argument("--image", required=True, help="Duong dan anh xe can xu ly")
    parser.add_argument("--output", default="output/result.jpg", help="Duong dan luu anh ket qua")

    # --- Tham so model ---
    parser.add_argument("--plate-model", default="models/plate_detector.pt",
                        help="Model YOLO detect bien so (chi dung khi --detect-engine yolo)")
    parser.add_argument("--char-model", default=None,
                        help="Model YOLO detect ky tu (chi dung khi --ocr-engine yolo)")

    # --- Tham so confidence ---
    parser.add_argument("--plate-conf", type=float, default=0.25,
                        help="Nguong confidence detect bien so (0.0 - 1.0)")
    parser.add_argument("--plate-conf-values", default=None,
                        help="Comma-separated plate confidence thresholds to try, e.g. 0.25,0.15,0.10")
    parser.add_argument("--fallback-plate-conf-values", default=None,
                        help="Comma-separated confidence thresholds for fallback detector, e.g. 0.20,0.15")
    parser.add_argument("--char-conf", type=float, default=0.25,
                        help="Nguong confidence detect ky tu (0.0 - 1.0)")

    # --- Tham so engine ---
    parser.add_argument("--ocr-engine", choices=["roboflow", "yolo"], default="roboflow",
                        help="Engine OCR chinh: roboflow hoac yolo")
    parser.add_argument("--fallback-ocr-engine", choices=["none", "gemini", "yolo"], default="none",
                        help="OCR fallback, chi dung khi OCR chinh sai/empty hoac khong detect duoc bien")
    parser.add_argument("--fallback-min-plate-score", type=float, default=0.35,
                        help="Dung fallback neu confidence detect bien thap hon nguong nay")
    parser.add_argument("--fallback-detect-engine", choices=["none", "yolo"], default="none",
                        help="Detector fallback, vi du model YOLO vua train khi detector chinh khong thay bien")
    parser.add_argument("--fallback-plate-model", default=None,
                        help="Model YOLO detector fallback vua train, vi du models/plate_detector_v2.pt")
    parser.add_argument("--fallback-char-model", default=None,
                        help="Model YOLO OCR fallback vua train, vi du models/char_detector.pt")
    parser.add_argument("--detect-engine", choices=["roboflow", "yolo"], default="roboflow",
                        help="Engine detect bien so: roboflow (chinh xac hon) hoac yolo (nhanh hon)")

    # --- Tham so Roboflow ---
    parser.add_argument("--roboflow-api-key", default=None,
                        help="API key Roboflow (hoac dung bien moi truong ROBOFLOW_API_KEY)")
    parser.add_argument("--roboflow-model-id", default="license-plate-ocr-hugcj/3",
                        help="Model OCR ky tu tren Roboflow")
    parser.add_argument("--roboflow-detect-model-id", default="license-plate-recognition-rxg4e/4",
                        help="Model detect bien so tren Roboflow")
    parser.add_argument("--roboflow-api-url", default="https://detect.roboflow.com",
                        help="URL API Roboflow")
    parser.add_argument("--roboflow-timeout", type=float, default=30.0,
                        help="Timeout request Roboflow/Gemini (giay)")
    parser.add_argument("--gemini-api-key", default=None,
                        help="API key Gemini (hoac dung bien moi truong GEMINI_API_KEY)")
    parser.add_argument("--gemini-model-id", default="gemini-2.5-flash",
                        help="Model Gemini Vision dung de doc bien so")
    parser.add_argument("--gemini-api-url", default="https://generativelanguage.googleapis.com/v1beta",
                        help="URL API Gemini")

    # --- Config ---
    parser.add_argument("--config", default="config/plate_rules.yaml",
                        help="File rule format bien so")

    args = parser.parse_args()

    # === Tao Pipeline ===
    pipeline = LicensePlatePipeline(
        plate_model_path=args.plate_model,
        char_model_path=args.char_model,
        plate_conf=args.plate_conf,
        char_conf=args.char_conf,
        config_path=args.config,
        ocr_engine=args.ocr_engine,
        detect_engine=args.detect_engine,
        roboflow_api_key=args.roboflow_api_key,
        roboflow_model_id=args.roboflow_model_id,
        roboflow_detect_model_id=args.roboflow_detect_model_id,
        roboflow_api_url=args.roboflow_api_url,
        roboflow_timeout=args.roboflow_timeout,
        gemini_api_key=args.gemini_api_key,
        gemini_model_id=args.gemini_model_id,
        gemini_api_url=args.gemini_api_url,
        fallback_ocr_engine=args.fallback_ocr_engine,
        fallback_min_plate_score=args.fallback_min_plate_score,
        fallback_detect_engine=args.fallback_detect_engine,
        fallback_plate_model_path=args.fallback_plate_model,
        fallback_char_model_path=args.fallback_char_model,
        plate_conf_values=parse_confidence_values(args.plate_conf_values, args.plate_conf),
        fallback_plate_conf_values=parse_confidence_values(
            args.fallback_plate_conf_values, args.plate_conf
        ),
    )

    # === Chay Pipeline ===
    output_image, results = pipeline.process_image(args.image)

    # === Luu va in ket qua ===
    ensure_dir("output")
    cv2.imwrite(args.output, output_image)

    print("\n" + "=" * 50)
    print("OCR Results:")
    print("=" * 50)
    for item in results:
        print(f"  Text: {item['text']}")
        print(f"  Score: {item['score']:.2f}")
        print(f"  Box: {item['box']}")
        if item.get("raw_text"):
            print(f"  Raw OCR rejected: {item['raw_text']}")
        print("-" * 50)

    print(f"Saved result to: {args.output}")


if __name__ == "__main__":
    main()
