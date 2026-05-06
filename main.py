# === Module: main.py ===
# Entry point chinh cua chuong trinh License Plate OCR.
#
# Flow:
# Anh xe -> Detect bien so (YOLO/Roboflow) -> crop -> Roboflow OCR -> sort -> text

import argparse
import cv2

from src.pipeline import LicensePlatePipeline
from src.utils import ensure_dir


def main():
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
    parser.add_argument("--char-conf", type=float, default=0.25,
                        help="Nguong confidence detect ky tu (0.0 - 1.0)")

    # --- Tham so engine ---
    parser.add_argument("--ocr-engine", choices=["roboflow", "yolo"], default="roboflow",
                        help="Engine OCR ky tu: roboflow (API) hoac yolo (local)")
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
                        help="Timeout request Roboflow (giay)")

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
        print("-" * 50)

    print(f"Saved result to: {args.output}")


if __name__ == "__main__":
    main()
