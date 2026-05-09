# === run.py ===
# Script tien ich: chay 1 lenh de xu ly anh va xem ket qua.
#
# Cach dung:
#   py run.py input/can-canh.jpg
#   py run.py input/test.jpg --conf 0.15
#   py run.py input/test.jpg --no-show
#   py run.py input/test.jpg --detect yolo     (dung YOLO local cho detect)
#   py run.py input/test.jpg             (auto: model hien tai -> model moi train -> Gemini)

import sys
import os
import cv2

from src.pipeline import LicensePlatePipeline
from src.utils import ensure_dir


def _read_env_key(name: str):
    value = os.getenv(name)
    if value:
        return value

    if os.path.isfile(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{name}="):
                    return line.split("=", 1)[1].strip()

    return None


def run(
    image_path: str,
    char_conf: float = 0.25,
    show: bool = True,
    detect_engine: str = "roboflow",
    ocr_engine: str = "roboflow",
    fallback_ocr_engine: str = "auto",
    fallback_detect_engine: str = "auto",
    plate_model_path: str = "models/plate_detector.pt",
    trained_plate_model_path: str = "models/plate_detector_v2.pt",
    char_model_path: str = "models/char_detector.pt"
):
    """
    Xu ly 1 anh va hien thi ket qua.

    Args:
        image_path: duong dan anh can xu ly
        char_conf: nguong confidence OCR ky tu
        show: True = tu dong mo anh ket qua
        detect_engine: "roboflow" (chinh xac) hoac "yolo" (nhanh, offline)
        ocr_engine: OCR chinh, "roboflow" hoac "yolo"
        fallback_ocr_engine: "auto", "none" hoac "gemini"; Gemini chi chay khi OCR chinh dang nghi
        fallback_detect_engine: "auto", "none" hoac "yolo"; auto se thu model moi train neu file ton tai
    """

    # Kiem tra file anh
    if not os.path.isfile(image_path):
        print(f"[ERROR] File khong ton tai: {image_path}")
        return

    # Tao ten file output
    basename = os.path.splitext(os.path.basename(image_path))[0]
    output_path = f"output/{basename}_result.jpg"

    # Doc API key tu bien moi truong hoac .env
    roboflow_api_key = _read_env_key("ROBOFLOW_API_KEY")
    gemini_api_key = _read_env_key("GEMINI_API_KEY")

    if detect_engine == "roboflow" and not roboflow_api_key:
        print("[ERROR] Chua co ROBOFLOW_API_KEY cho detect-engine roboflow.")
        print("  Tao file .env voi noi dung: ROBOFLOW_API_KEY=key_cua_ban")
        return

    if ocr_engine == "roboflow" and not roboflow_api_key:
        print("[ERROR] Chua co ROBOFLOW_API_KEY cho ocr-engine roboflow.")
        print("  Tao file .env voi noi dung: ROBOFLOW_API_KEY=key_cua_ban")
        return

    if ocr_engine == "gemini":
        print("[WARN] --ocr gemini khong con duoc dung lam OCR chinh; chuyen sang fallback Gemini.")
        ocr_engine = "roboflow"
        fallback_ocr_engine = "gemini"

    if ocr_engine == "yolo" and not os.path.isfile(char_model_path):
        print(f"[ERROR] Khong tim thay char model cho OCR chinh: {char_model_path}")
        return

    if fallback_ocr_engine == "auto":
        if os.path.isfile(char_model_path):
            fallback_ocr_engine = "yolo"
        elif gemini_api_key:
            fallback_ocr_engine = "gemini"
        else:
            fallback_ocr_engine = "none"

    if fallback_detect_engine == "auto":
        fallback_detect_engine = "yolo" if os.path.isfile(trained_plate_model_path) else "none"

    use_yolo_ocr = ocr_engine == "yolo" or (
        fallback_ocr_engine == "yolo" and os.path.isfile(char_model_path)
    )
    if use_yolo_ocr and not os.path.isfile(char_model_path):
        print(f"[ERROR] Khong tim thay char model: {char_model_path}")
        return

    if fallback_ocr_engine == "gemini" and not gemini_api_key:
        print("[ERROR] Chua co GEMINI_API_KEY cho fallback Gemini.")
        print("  Tao file .env voi noi dung: GEMINI_API_KEY=key_cua_ban")
        return

    # Tao pipeline
    pipeline = LicensePlatePipeline(
        plate_model_path=plate_model_path,
        char_model_path=char_model_path if os.path.isfile(char_model_path) else None,
        char_conf=char_conf,
        ocr_engine=ocr_engine,
        detect_engine=detect_engine,
        roboflow_api_key=roboflow_api_key,
        gemini_api_key=gemini_api_key,
        fallback_ocr_engine=fallback_ocr_engine,
        fallback_detect_engine=fallback_detect_engine,
        fallback_plate_model_path=trained_plate_model_path,
        fallback_char_model_path=char_model_path if os.path.isfile(char_model_path) else None
    )

    # Chay pipeline
    output_image, results = pipeline.process_image(image_path)

    # Luu anh ket qua
    ensure_dir("output")
    cv2.imwrite(output_path, output_image)

    # In ket qua
    print("\n" + "=" * 50)
    print(f"  KET QUA OCR BIEN SO XE")
    print("=" * 50)

    if not results:
        print("  Khong detect duoc bien so nao.")
    else:
        for i, item in enumerate(results, 1):
            print(f"  Bien so {i}: {item['text']}")
            print(f"  Score:     {item['score']:.2f}")
            print(f"  Box:       {item['box']}")
            if i < len(results):
                print("-" * 50)

    print("=" * 50)
    print(f"  Anh ket qua: {output_path}")
    print("=" * 50)

    # Mo anh ket qua
    if show:
        os.startfile(os.path.abspath(output_path))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Cach dung:")
        print("  py run.py <duong_dan_anh>")
        print("  py run.py input/can-canh.jpg")
        print("  py run.py input/test.jpg --conf 0.15")
        print("  py run.py input/test.jpg --no-show")
        print("  py run.py input/test.jpg --detect yolo")
        print("  py run.py input/test.jpg")
        print("  py run.py input/test.jpg --trained-plate-model models/plate_detector_v2.pt")
        sys.exit(1)

    img = sys.argv[1]

    # Parse --conf
    conf = 0.25
    if "--conf" in sys.argv:
        idx = sys.argv.index("--conf")
        if idx + 1 < len(sys.argv):
            conf = float(sys.argv[idx + 1])

    # Parse --no-show
    show = "--no-show" not in sys.argv

    # Parse --detect
    det_engine = "roboflow"
    if "--detect" in sys.argv:
        idx = sys.argv.index("--detect")
        if idx + 1 < len(sys.argv):
            det_engine = sys.argv[idx + 1]

    # Parse --ocr
    ocr_engine = "roboflow"
    if "--ocr" in sys.argv:
        idx = sys.argv.index("--ocr")
        if idx + 1 < len(sys.argv):
            ocr_engine = sys.argv[idx + 1]

    # Parse --fallback
    fallback_ocr_engine = "auto"
    if "--fallback" in sys.argv:
        idx = sys.argv.index("--fallback")
        if idx + 1 < len(sys.argv):
            fallback_ocr_engine = sys.argv[idx + 1]

    # Parse fallback detector / model paths
    fallback_detect_engine = "auto"
    if "--fallback-detect" in sys.argv:
        idx = sys.argv.index("--fallback-detect")
        if idx + 1 < len(sys.argv):
            fallback_detect_engine = sys.argv[idx + 1]

    plate_model_path = "models/plate_detector.pt"
    if "--plate-model" in sys.argv:
        idx = sys.argv.index("--plate-model")
        if idx + 1 < len(sys.argv):
            plate_model_path = sys.argv[idx + 1]

    trained_plate_model_path = "models/plate_detector_v2.pt"
    if "--trained-plate-model" in sys.argv:
        idx = sys.argv.index("--trained-plate-model")
        if idx + 1 < len(sys.argv):
            trained_plate_model_path = sys.argv[idx + 1]

    char_model_path = "models/char_detector.pt"
    if "--char-model" in sys.argv:
        idx = sys.argv.index("--char-model")
        if idx + 1 < len(sys.argv):
            char_model_path = sys.argv[idx + 1]

    run(
        img,
        char_conf=conf,
        show=show,
        detect_engine=det_engine,
        ocr_engine=ocr_engine,
        fallback_ocr_engine=fallback_ocr_engine,
        fallback_detect_engine=fallback_detect_engine,
        plate_model_path=plate_model_path,
        trained_plate_model_path=trained_plate_model_path,
        char_model_path=char_model_path,
    )
