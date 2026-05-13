# === run.py ===
# Script tien ich: chay 1 lenh de xu ly anh va xem ket qua.
#
# Cach dung:
#   py run.py input/can-canh.jpg
#   py run.py input/test.jpg --conf 0.15
#   py run.py input/test.jpg --show
#   py run.py input/test.jpg --detect yolo     (dung YOLO local cho detect)
#   py run.py input/test.jpg             (mac dinh: YOLO local plate + YOLO local char)
#   py run.py input-not-detect            (xu ly tat ca anh trong folder)

import sys
import os
from pathlib import Path

import cv2

from src.pipeline import LicensePlatePipeline
from src.utils import ensure_dir


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _read_env_key(name: str):
    value = os.getenv(name)
    if value:
        return value.strip().strip('"').strip("'")

    if os.path.isfile(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, value = line.split("=", 1)
                if key.strip() == name:
                    return value.strip().strip('"').strip("'")

    return None


def run(
    image_path: str,
    char_conf: float = 0.25,
    show: bool = False,
    detect_engine: str = "yolo",
    ocr_engine: str = "yolo",
    fallback_ocr_engine: str = "roboflow",
    fallback_detect_engine: str = "none",
    final_fallback_ocr_engine: str = "gemini",
    plate_model_path: str = "models/plate_detector_v2.pt",
    fallback_plate_model_path: str = "models/plate_detector.pt",
    char_model_path: str = "models/char_detector.pt",
    api_timeout: float = 60.0,
    debug_chars: bool = False
):
    """
    Xu ly 1 anh va hien thi ket qua.

    Args:
        image_path: duong dan anh can xu ly
        char_conf: nguong confidence OCR ky tu
        show: True = tu dong mo anh ket qua
        detect_engine: "roboflow" (chinh xac) hoac "yolo" (nhanh, offline)
        ocr_engine: OCR chinh, "roboflow" hoac "yolo"
        fallback_ocr_engine: "auto", "none", "roboflow", "yolo" hoac "gemini"
        fallback_detect_engine: "auto", "none" hoac "yolo"
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
        print("[WARN] --ocr gemini khong con duoc dung lam OCR chinh; chuyen sang final fallback Gemini.")
        if os.path.isfile(char_model_path):
            ocr_engine = "yolo"
        elif roboflow_api_key:
            ocr_engine = "roboflow"
        else:
            ocr_engine = "gemini"
        final_fallback_ocr_engine = "gemini"

    explicit_fallback_ocr_engine = fallback_ocr_engine
    explicit_final_fallback_ocr_engine = final_fallback_ocr_engine

    if fallback_ocr_engine == "auto":
        if ocr_engine != "roboflow" and roboflow_api_key:
            fallback_ocr_engine = "roboflow"
            print("[INFO] Fallback OCR: RoboflowCharacterOCR (auto)")
        elif ocr_engine != "gemini" and gemini_api_key:
            fallback_ocr_engine = "gemini"
            print("[INFO] Fallback OCR: Gemini (auto, Roboflow key missing)")
        else:
            fallback_ocr_engine = "none"
            print("[WARN] Fallback OCR disabled: missing ROBOFLOW_API_KEY/GEMINI_API_KEY")

    if final_fallback_ocr_engine == "auto":
        if fallback_ocr_engine != "gemini" and ocr_engine != "gemini" and gemini_api_key:
            final_fallback_ocr_engine = "gemini"
            print("[INFO] Final fallback OCR: Gemini (auto)")
        else:
            final_fallback_ocr_engine = "none"
            if not gemini_api_key:
                print("[WARN] Final fallback OCR disabled: missing GEMINI_API_KEY")

    if fallback_detect_engine == "auto":
        fallback_detect_engine = "yolo" if os.path.isfile(fallback_plate_model_path) else "none"

    if ocr_engine == "yolo" and not os.path.isfile(char_model_path):
        print(f"[WARN] Khong tim thay char model: {char_model_path}")
        if roboflow_api_key:
            print("  -> Tu dong chuyen OCR chinh sang Roboflow do chua co model YOLO.")
            ocr_engine = "roboflow"
        elif gemini_api_key:
            print("  -> Tu dong chuyen OCR chinh sang Gemini do chua co YOLO/Roboflow.")
            ocr_engine = "gemini"
            fallback_ocr_engine = "none"
            final_fallback_ocr_engine = "none"
        else:
            print("  -> Khong co ROBOFLOW_API_KEY/GEMINI_API_KEY de fallback. Hay copy model vao models/char_detector.pt")
            print("     hoac truyen --char-model <duong_dan_best.pt>.")
            return

    if fallback_ocr_engine == ocr_engine:
        print(f"[WARN] Fallback OCR '{fallback_ocr_engine}' trung OCR chinh; bo qua fallback trung lap.")
        fallback_ocr_engine = "none"

    if fallback_ocr_engine == "roboflow" and not roboflow_api_key:
        if explicit_fallback_ocr_engine == "auto":
            fallback_ocr_engine = "none"
            print("[WARN] Roboflow fallback disabled: missing ROBOFLOW_API_KEY")
        else:
            print("[ERROR] Chua co ROBOFLOW_API_KEY cho fallback Roboflow.")
            print("  Tao file .env voi noi dung: ROBOFLOW_API_KEY=key_cua_ban")
            return

    if fallback_ocr_engine == "gemini" and not gemini_api_key:
        if explicit_fallback_ocr_engine == "auto":
            fallback_ocr_engine = "none"
            print("[WARN] Gemini fallback disabled: missing GEMINI_API_KEY")
        else:
            print("[ERROR] Chua co GEMINI_API_KEY cho fallback Gemini.")
            print("  Tao file .env voi noi dung: GEMINI_API_KEY=key_cua_ban")
            return

    if final_fallback_ocr_engine == "gemini" and not gemini_api_key:
        if explicit_final_fallback_ocr_engine == "auto":
            final_fallback_ocr_engine = "none"
            print("[WARN] Gemini final fallback disabled: missing GEMINI_API_KEY")
        else:
            print("[ERROR] Chua co GEMINI_API_KEY cho final fallback Gemini.")
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
        roboflow_timeout=api_timeout,
        fallback_ocr_engine=fallback_ocr_engine,
        fallback_detect_engine=fallback_detect_engine,
        final_fallback_ocr_engine=final_fallback_ocr_engine,
        fallback_plate_model_path=fallback_plate_model_path,
        fallback_char_model_path=char_model_path if os.path.isfile(char_model_path) else None,
        debug_chars=debug_chars
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
            text = item.get("text", "")
            display_text = text if text.strip() else "<OCR_EMPTY>"
            print(f"  Bien so {i}: {display_text}")
            print(f"  Score:     {item['score']:.2f}")
            print(f"  Box:       {item['box']}")
            if item.get("ocr_source"):
                print(f"  OCR:       {item['ocr_source']}")
            if item.get("raw_text"):
                print(f"  Raw OCR rejected: {item['raw_text']}")
            if not text.strip():
                print("  Trang thai: detect_duoc_vung_bien_nhung_ocr_rong")
            if i < len(results):
                print("-" * 50)

    print("=" * 50)
    print(f"  Anh ket qua: {output_path}")
    print("=" * 50)

    # Mo anh ket qua
    if show:
        os.startfile(os.path.abspath(output_path))


def _collect_image_paths(source_path: str):
    """Tra ve danh sach anh tu 1 file hoac toan bo anh trong 1 folder."""
    source = Path(source_path)

    if source.is_file():
        if source.suffix.lower() in IMAGE_EXTENSIONS:
            return [str(source)]
        print(f"[ERROR] File khong phai dinh dang anh ho tro: {source_path}")
        return []

    if source.is_dir():
        images = []
        for root, _, files in os.walk(source):
            for filename in files:
                path = Path(root) / filename
                if path.suffix.lower() in IMAGE_EXTENSIONS:
                    images.append(str(path))
        return sorted(images)

    print(f"[ERROR] Source khong ton tai: {source_path}")
    return []


def run_source(source_path: str, **kwargs):
    """Xu ly 1 anh hoac tat ca anh trong 1 folder bang cung mot lenh."""
    image_paths = _collect_image_paths(source_path)
    if not image_paths:
        print("[ERROR] Khong tim thay anh nao de xu ly.")
        return

    show = kwargs.get("show", False)
    if len(image_paths) > 1 and show:
        print("[INFO] Source la folder; tu dong tat mo anh ket qua cho tung file.")
        kwargs["show"] = False

    print(f"[INFO] Found {len(image_paths)} image(s) in source: {source_path}")
    for index, image_path in enumerate(image_paths, 1):
        print("\n" + "#" * 60)
        print(f"# Processing {index}/{len(image_paths)}: {image_path}")
        print("#" * 60)
        run(image_path, **kwargs)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Cach dung:")
        print("  py run.py <duong_dan_anh_hoac_folder>")
        print("  py run.py input/can-canh.jpg")
        print("  py run.py input/test.jpg --conf 0.15")
        print("  py run.py input/test.jpg --show")
        print("  py run.py input/test.jpg --detect yolo")
        print("  py run.py input/test.jpg --debug-chars")
        print("  py run.py input/test.jpg --fallback none --final-fallback none")
        print("  py run.py input/test.jpg --timeout 30")
        print("  py run.py input/test.jpg")
        print("  py run.py input-not-detect")
        print("  py run.py input/test.jpg --plate-model models/plate_detector_v2.pt")
        sys.exit(1)

    img = sys.argv[1]

    # Parse --conf
    conf = 0.25
    if "--conf" in sys.argv:
        idx = sys.argv.index("--conf")
        if idx + 1 < len(sys.argv):
            conf = float(sys.argv[idx + 1])

    # Mac dinh khong mo anh ket qua. Dung --show neu can mo bang app mac dinh.
    show = "--show" in sys.argv

    # Parse --detect
    det_engine = "yolo"
    if "--detect" in sys.argv:
        idx = sys.argv.index("--detect")
        if idx + 1 < len(sys.argv):
            det_engine = sys.argv[idx + 1]

    # Parse --ocr
    ocr_engine = "yolo"
    if "--ocr" in sys.argv:
        idx = sys.argv.index("--ocr")
        if idx + 1 < len(sys.argv):
            ocr_engine = sys.argv[idx + 1]

    # Parse --fallback
    fallback_ocr_engine = "roboflow"
    if "--fallback" in sys.argv:
        idx = sys.argv.index("--fallback")
        if idx + 1 < len(sys.argv):
            fallback_ocr_engine = sys.argv[idx + 1]

    # Parse fallback detector / model paths
    fallback_detect_engine = "none"
    if "--fallback-detect" in sys.argv:
        idx = sys.argv.index("--fallback-detect")
        if idx + 1 < len(sys.argv):
            fallback_detect_engine = sys.argv[idx + 1]

    # Parse final fallback
    final_fallback_ocr_engine = "gemini"
    if "--final-fallback" in sys.argv:
        idx = sys.argv.index("--final-fallback")
        if idx + 1 < len(sys.argv):
            final_fallback_ocr_engine = sys.argv[idx + 1]

    plate_model_path = "models/plate_detector_v2.pt"
    if "--plate-model" in sys.argv:
        idx = sys.argv.index("--plate-model")
        if idx + 1 < len(sys.argv):
            plate_model_path = sys.argv[idx + 1]

    fallback_plate_model_path = "models/plate_detector.pt"
    if "--fallback-plate-model" in sys.argv:
        idx = sys.argv.index("--fallback-plate-model")
        if idx + 1 < len(sys.argv):
            fallback_plate_model_path = sys.argv[idx + 1]

    char_model_path = "models/char_detector.pt"
    if "--char-model" in sys.argv:
        idx = sys.argv.index("--char-model")
        if idx + 1 < len(sys.argv):
            char_model_path = sys.argv[idx + 1]

    debug_chars = "--debug-chars" in sys.argv

    api_timeout = 60.0
    if "--timeout" in sys.argv:
        idx = sys.argv.index("--timeout")
        if idx + 1 < len(sys.argv):
            api_timeout = float(sys.argv[idx + 1])

    run_source(
        img,
        char_conf=conf,
        show=show,
        detect_engine=det_engine,
        ocr_engine=ocr_engine,
        fallback_ocr_engine=fallback_ocr_engine,
        fallback_detect_engine=fallback_detect_engine,
        final_fallback_ocr_engine=final_fallback_ocr_engine,
        plate_model_path=plate_model_path,
        fallback_plate_model_path=fallback_plate_model_path,
        char_model_path=char_model_path,
        api_timeout=api_timeout,
        debug_chars=debug_chars,
    )
