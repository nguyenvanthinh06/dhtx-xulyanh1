# === Module: pipeline.py ===
# Module trung tam, dieu phoi toan bo quy trinh xu ly bien so xe.
# Pipeline:
# Anh xe -> Detect vung bien so -> crop -> OCR detect ky tu -> sort -> text

import os
import re
from typing import Optional

import cv2

from src.detector import PlateDetector
from src.ocr_gemini import GeminiPlateOCR
from src.ocr_roboflow import RoboflowCharacterOCR
from src.ocr_yolo import YoloCharacterOCR
from src.utils import crop_image, draw_result


class LicensePlatePipeline:
    """
    Pipeline xu ly bien so xe end-to-end.

    Ho tro nhieu engine cho moi buoc:
    - Detect bien so: YOLO local hoac Roboflow API
    - OCR: Roboflow/Yolo detect ky tu hoac Gemini doc text fallback

    Mac dinh: dung Roboflow cho CA HAI buoc.
    """

    def __init__(
        self,
        plate_model_path: str = "models/plate_detector.pt",
        char_model_path: Optional[str] = None,
        plate_conf: float = 0.25,
        char_conf: float = 0.25,
        config_path: str = "config/plate_rules.yaml",
        ocr_engine: str = "roboflow",
        detect_engine: str = "roboflow",
        roboflow_api_key: Optional[str] = None,
        roboflow_model_id: str = "license-plate-ocr-hugcj/3",
        roboflow_api_url: str = "https://detect.roboflow.com",
        roboflow_timeout: float = 30.0,
        roboflow_detect_model_id: str = "license-plate-recognition-rxg4e/4",
        gemini_api_key: Optional[str] = None,
        gemini_model_id: str = "gemini-2.5-flash",
        gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta",
        fallback_ocr_engine: str = "none",
        fallback_min_plate_score: float = 0.35,
    ):
        # Lay API key: uu tien tu tham so, sau do doc bien moi truong
        api_key = roboflow_api_key or os.getenv("ROBOFLOW_API_KEY")
        gemini_key = gemini_api_key or os.getenv("GEMINI_API_KEY")

        # === Tao Plate Detector ===
        self.plate_detector = PlateDetector(
            model_path=plate_model_path,
            conf=plate_conf,
            engine=detect_engine,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_detect_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout
        )

        self.fallback_min_plate_score = fallback_min_plate_score

        # === Tao OCR Engine chinh ===
        self.ocr = self._build_ocr(
            ocr_engine=ocr_engine,
            char_model_path=char_model_path,
            conf=char_conf,
            config_path=config_path,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout,
            gemini_api_key=gemini_key,
            gemini_model_id=gemini_model_id,
            gemini_api_url=gemini_api_url
        )

        # === Tao OCR fallback (chi goi khi OCR chinh sai/empty hoac khong detect duoc bien) ===
        self.fallback_ocr = self._build_ocr(
            ocr_engine=fallback_ocr_engine,
            char_model_path=char_model_path,
            conf=char_conf,
            config_path=config_path,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout,
            gemini_api_key=gemini_key,
            gemini_model_id=gemini_model_id,
            gemini_api_url=gemini_api_url,
            optional=True,
        )

    def _build_ocr(
        self,
        ocr_engine: str,
        char_model_path: Optional[str],
        conf: float,
        config_path: str,
        roboflow_api_key: Optional[str],
        roboflow_model_id: str,
        roboflow_api_url: str,
        roboflow_timeout: float,
        gemini_api_key: Optional[str],
        gemini_model_id: str,
        gemini_api_url: str,
        optional: bool = False,
    ):
        """Factory method: tao OCR engine."""
        ocr_engine = ocr_engine.lower()

        if ocr_engine in {"none", ""}:
            if optional:
                return None
            raise ValueError("OCR engine cannot be 'none' for primary OCR.")

        if ocr_engine == "roboflow":
            if not roboflow_api_key:
                raise ValueError(
                    "Missing Roboflow API key. Set ROBOFLOW_API_KEY or pass "
                    "--roboflow-api-key."
                )

            print(f"[Pipeline] OCR engine: Roboflow ({roboflow_model_id})")

            return RoboflowCharacterOCR(
                api_key=roboflow_api_key,
                model_id=roboflow_model_id,
                api_url=roboflow_api_url,
                conf=conf,
                config_path=config_path,
                timeout=roboflow_timeout
            )

        if ocr_engine == "gemini":
            if not gemini_api_key:
                raise ValueError(
                    "Missing Gemini API key. Set GEMINI_API_KEY or pass "
                    "--gemini-api-key."
                )

            print(f"[Pipeline] OCR engine: Gemini ({gemini_model_id})")

            return GeminiPlateOCR(
                api_key=gemini_api_key,
                model_id=gemini_model_id,
                api_url=gemini_api_url,
                config_path=config_path,
                timeout=roboflow_timeout
            )

        if ocr_engine == "yolo":
            if not char_model_path:
                raise ValueError("Missing --char-model when --ocr-engine yolo.")

            print(f"[Pipeline] OCR engine: YOLO ({char_model_path})")

            return YoloCharacterOCR(
                model_path=char_model_path,
                conf=conf,
                config_path=config_path
            )

        raise ValueError(f"Unsupported OCR engine: {ocr_engine}")

    def _is_valid_plate_text(self, text):
        """Kiem tra text OCR co giong format bien so Viet Nam hay khong."""
        normalized = re.sub(r"[^0-9A-Z]", "", text.upper())
        return bool(re.match(r"^[0-9]{2}[A-Z]{1,2}[0-9]{4,6}$", normalized))

    def _should_use_fallback(self, text, score):
        if self.fallback_ocr is None:
            return False
        if not text.strip():
            return True
        if not self._is_valid_plate_text(text):
            return True
        return score < self.fallback_min_plate_score

    def _recognize_with_fallback(self, processed_crop, score):
        try:
            text = self.ocr.recognize(processed_crop)
        except Exception as exc:
            if self.fallback_ocr is None:
                raise
            print(f"  [Pipeline] Primary OCR error: {exc}")
            text = ""

        if self._should_use_fallback(text, score):
            print("  [Pipeline] OCR suspicious; using fallback OCR")
            fallback_text = self.fallback_ocr.recognize(processed_crop)
            if fallback_text.strip():
                return fallback_text

        return text

    def _preprocess_plate(self, plate_crop):
        """
        Tien xu ly anh crop bien so truoc khi gui cho OCR.

        Chi phong to anh nho (< 150px chieu rong) de Roboflow OCR
        de nhan dien ky tu hon. Giu nguyen mau sac goc de khong
        lam anh huong den accuracy cua model.

        Args:
            plate_crop: numpy array (BGR) - anh crop bien so goc

        Returns:
            numpy array (BGR) - anh da tien xu ly
        """
        h, w = plate_crop.shape[:2]

        # Phong to anh nho: neu chieu rong < 150px, phong to len >= 300px.
        # Roboflow OCR hoat dong tot hon voi anh lon, ky tu ro rang.
        # Giu nguyen anh mau (BGR) de model nhan dien chinh xac.
        if w < 150:
            # Tinh ti le phong to de dat toi thieu 300px chieu rong
            scale = max(2, 300 // w)
            plate_crop = cv2.resize(
                plate_crop,
                (w * scale, h * scale),
                interpolation=cv2.INTER_CUBIC  # Phong to muot, it bi vo
            )
            print(f"  [Preprocess] Upscaled {w}x{h} -> {w*scale}x{h*scale}")

        return plate_crop

    def process_image(self, image_path: str):
        """
        Xu ly 1 anh xe: detect bien so, OCR, ve ket qua.

        Args:
            image_path: duong dan anh xe

        Returns:
            tuple: (output_image, results)
        """
        # Doc anh tu file
        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")

        h, w = image.shape[:2]
        print(f"[Pipeline] Image loaded: {image_path} ({w}x{h})")

        # === Buoc 1: Detect vung bien so ===
        plates = self.plate_detector.detect(image)

        results = []

        can_fallback_full_image = (
            self.fallback_ocr is not None
            and getattr(self.fallback_ocr, "can_process_full_image", False)
        )
        if not plates and can_fallback_full_image:
            print("[Pipeline] No plate detected; using fallback OCR on full image")
            text = self.fallback_ocr.recognize(image)
            if text:
                full_box = [0, 0, w, h]
                results.append({
                    "box": full_box,
                    "score": 0.0,
                    "text": text
                })
                draw_result(image, full_box, text, None)
            return image, results

        # === Buoc 2-5: Xu ly tung bien so ===
        for i, plate in enumerate(plates):
            box = plate["box"]
            score = plate["score"]

            print(f"\n[Pipeline] Processing plate {i+1}/{len(plates)}: "
                  f"box={box}, score={score:.2f}")

            # === Buoc 2: Crop bien so ===
            plate_crop = crop_image(image, box, padding=10)

            if plate_crop.size == 0:
                print(f"  [Pipeline] Skipped: empty crop")
                continue

            ch, cw = plate_crop.shape[:2]
            print(f"  [Pipeline] Plate crop size: {cw}x{ch}")

            # === Buoc 2.5: Tien xu ly anh crop ===
            processed_crop = self._preprocess_plate(plate_crop)

            # === Buoc 3-5: OCR chinh, chi fallback khi ket qua dang nghi ===
            text = self._recognize_with_fallback(processed_crop, score)

            print(f"  [Pipeline] OCR result: '{text}'")

            results.append({
                "box": box,
                "score": score,
                "text": text
            })

            draw_result(image, box, text, score)

        return image, results
