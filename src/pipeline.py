# === Module: pipeline.py ===
# Module trung tam, dieu phoi toan bo quy trinh xu ly bien so xe.
# Pipeline:
# Anh xe -> Detect vung bien so -> crop -> OCR detect ky tu -> sort -> text

import os
from typing import Optional

import cv2
import numpy as np

from src.detector import PlateDetector
from src.ocr_roboflow import RoboflowCharacterOCR
from src.ocr_yolo import YoloCharacterOCR
from src.utils import crop_image, draw_result


class LicensePlatePipeline:
    """
    Pipeline xu ly bien so xe end-to-end.

    Ho tro 2 engine cho moi buoc:
    - Detect bien so: YOLO local hoac Roboflow API
    - OCR ky tu: Roboflow API hoac YOLO local

    Mac dinh: dung Roboflow cho CA HAI buoc (chinh xac nhat).
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
    ):
        # Lay API key: uu tien tu tham so, sau do doc bien moi truong
        api_key = roboflow_api_key or os.getenv("ROBOFLOW_API_KEY")

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

        # === Tao OCR Engine ===
        self.ocr = self._build_ocr(
            ocr_engine=ocr_engine,
            char_model_path=char_model_path,
            conf=char_conf,
            config_path=config_path,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout
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
        roboflow_timeout: float
    ):
        """Factory method: tao OCR engine."""
        ocr_engine = ocr_engine.lower()

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

            # === Buoc 3-5: OCR ===
            text = self.ocr.recognize(processed_crop)

            print(f"  [Pipeline] OCR result: '{text}'")

            results.append({
                "box": box,
                "score": score,
                "text": text
            })

            draw_result(image, box, text, score)

        return image, results
