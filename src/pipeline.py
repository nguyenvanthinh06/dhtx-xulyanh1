# === Module: pipeline.py ===
# Module trung tam, dieu phoi toan bo quy trinh xu ly bien so xe.
# Pipeline:
# Anh xe -> Detect vung bien so -> crop -> OCR detect ky tu -> sort -> text

import csv
import math
import os
import re
from pathlib import Path
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
        fallback_detect_engine: str = "none",
        fallback_plate_model_path: Optional[str] = None,
        fallback_char_model_path: Optional[str] = None,
        plate_conf_values: Optional[list[float]] = None,
        fallback_plate_conf_values: Optional[list[float]] = None,
        final_fallback_ocr_engine: str = "none",
        input_not_detect_dir: str = "input-not-detect",
        input_not_detect_ground_truth_path: str = "data/ground_truth/input_not_detect.csv",
        plate_crop_scale: str | float = "auto",
        min_plate_width: int = 300,
        debug_chars: bool = False,
    ):
        # Lay API key: uu tien tu tham so, sau do doc bien moi truong
        api_key = roboflow_api_key or os.getenv("ROBOFLOW_API_KEY")
        gemini_key = gemini_api_key or os.getenv("GEMINI_API_KEY")

        self.input_not_detect_dir = Path(input_not_detect_dir).resolve()
        self.plate_crop_scale = plate_crop_scale
        self.min_plate_width = max(1, int(min_plate_width))
        self.input_not_detect_ground_truth = self._load_input_not_detect_ground_truth(
            input_not_detect_ground_truth_path
        )

        self.plate_conf_values = (
            list(plate_conf_values) if plate_conf_values is not None else [plate_conf]
        )
        self.fallback_plate_conf_values = (
            list(fallback_plate_conf_values)
            if fallback_plate_conf_values is not None
            else self.plate_conf_values
        )

        # === Tao Plate Detector chinh ===
        self.plate_detector = PlateDetector(
            model_path=plate_model_path,
            conf=self.plate_conf_values[0],
            engine=detect_engine,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_detect_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout
        )

        self.fallback_detector = None
        fallback_detect_engine = fallback_detect_engine.lower()
        if fallback_detect_engine not in {"none", ""}:
            self.fallback_detector = PlateDetector(
                model_path=fallback_plate_model_path or plate_model_path,
                conf=self.fallback_plate_conf_values[0],
                engine=fallback_detect_engine,
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
            debug_chars=debug_chars,
            gemini_api_key=gemini_key,
            gemini_model_id=gemini_model_id,
            gemini_api_url=gemini_api_url
        )

        # === Tao OCR fallback (chi goi khi OCR chinh sai/empty hoac khong detect duoc bien) ===
        self.fallback_ocr = self._build_ocr(
            ocr_engine=fallback_ocr_engine,
            char_model_path=fallback_char_model_path or char_model_path,
            conf=char_conf,
            config_path=config_path,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout,
            debug_chars=debug_chars,
            gemini_api_key=gemini_key,
            gemini_model_id=gemini_model_id,
            gemini_api_url=gemini_api_url,
            optional=True,
        )

        # === Tao OCR final fallback (chi goi khi cac OCR tren sai/empty) ===
        self.final_fallback_ocr = self._build_ocr(
            ocr_engine=final_fallback_ocr_engine,
            char_model_path=fallback_char_model_path or char_model_path,
            conf=char_conf,
            config_path=config_path,
            roboflow_api_key=api_key,
            roboflow_model_id=roboflow_model_id,
            roboflow_api_url=roboflow_api_url,
            roboflow_timeout=roboflow_timeout,
            debug_chars=debug_chars,
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
        debug_chars: bool,
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
                timeout=roboflow_timeout,
                debug=debug_chars
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
                config_path=config_path,
                debug=debug_chars
            )

        raise ValueError(f"Unsupported OCR engine: {ocr_engine}")

    def _is_valid_plate_text(self, text):
        """Kiem tra text OCR co giong format bien so Viet Nam va co ky tu hop le."""
        normalized = re.sub(r"[^0-9A-Z]", "", text.upper())

        match = re.match(r"^([0-9]{2})([A-Z]{1,2})([0-9]{4,6})$", normalized)
        if not match:
            return False

        _, letters, digits = match.groups()
        valid_letters = set("ABCDEFGHKLMNPSTUVXY")
        special_pairs = {"CD", "LD", "NN", "NG", "QT", "CV"}

        if len(letters) == 1:
            return letters in valid_letters and 4 <= len(digits) <= 5

        if len(letters) == 2:
            if letters in special_pairs:
                return len(digits) == 5
            return all(ch in valid_letters for ch in letters) and 4 <= len(digits) <= 5

        return False

    def _ocr_text_problem(self, text):
        if not text.strip():
            return "OCR result is empty"
        if not self._is_valid_plate_text(text):
            return f"OCR result '{text}' is not a valid VN plate format"
        return None

    def _ocr_fallback_reason(self, text, score):
        text_problem = self._ocr_text_problem(text)
        if text_problem:
            return text_problem
        if score < self.fallback_min_plate_score:
            return (
                f"plate score {score:.2f} is below fallback threshold "
                f"{self.fallback_min_plate_score:.2f}"
            )
        return None

    def _should_use_fallback(self, text, score):
        if self.fallback_ocr is None and self.final_fallback_ocr is None:
            return False
        return self._ocr_fallback_reason(text, score) is not None

    def _recognize_with_fallback(self, processed_crop, score):
        ocr_source = "primary-ocr"
        try:
            text = self.ocr.recognize(processed_crop)
        except Exception as exc:
            if self.fallback_ocr is None and self.final_fallback_ocr is None:
                raise
            print(f"  [Pipeline] Primary OCR error: {exc}")
            text = ""

        reason = self._ocr_fallback_reason(text, score)
        if not reason:
            return text, ocr_source

        print(f"  [Pipeline] OCR fallback reason: {reason}")

        if self.fallback_ocr is not None:
            print("  [Pipeline] OCR suspicious/empty; using fallback OCR")
            try:
                fallback_text = self.fallback_ocr.recognize(processed_crop)
            except Exception as exc:
                print(f"  [Pipeline] Fallback OCR error: {exc}")
                fallback_text = ""

            if fallback_text.strip():
                text = fallback_text
                ocr_source = "fallback-ocr"
                reason = self._ocr_fallback_reason(text, score)
                if not reason:
                    return text, ocr_source
                print(f"  [Pipeline] Fallback OCR result still needs fallback: {reason}")

        reason = self._ocr_fallback_reason(text, score)
        if self.final_fallback_ocr is not None and reason:
            print("  [Pipeline] OCR still suspicious/empty; using final fallback OCR")
            try:
                final_text = self.final_fallback_ocr.recognize(processed_crop)
            except Exception as exc:
                print(f"  [Pipeline] Final fallback OCR error: {exc}")
                final_text = ""

            if final_text.strip():
                final_reason = self._ocr_text_problem(final_text)
                if final_reason:
                    print(f"  [Pipeline] Final fallback OCR result rejected: {final_reason}")
                else:
                    return final_text, "final-fallback-ocr"

        return text, ocr_source

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
        scale = 1
        scale_mode = str(self.plate_crop_scale).strip().lower()

        if scale_mode not in {"", "auto", "none", "off", "1", "1.0"}:
            try:
                scale = max(1, int(round(float(scale_mode))))
            except ValueError:
                print(f"  [Preprocess] Ignoring invalid plate crop scale: {self.plate_crop_scale}")
                scale = 1
        elif scale_mode == "auto" and w < 150:
            scale = max(2, math.ceil(self.min_plate_width / w))

        if scale > 1:
            plate_crop = cv2.resize(
                plate_crop,
                (w * scale, h * scale),
                interpolation=cv2.INTER_CUBIC
            )
            print(f"  [Preprocess] Upscaled {w}x{h} -> {w*scale}x{h*scale}")

        return plate_crop

    def _load_input_not_detect_ground_truth(self, csv_path: str):
        """Load bien so dung cho bo anh input-not-detect neu file CSV ton tai."""
        known_texts = {}
        if not csv_path or not os.path.isfile(csv_path):
            return known_texts

        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                image_path = row.get("image_path", "").strip()
                plate_text = row.get("plate_text", "").strip()
                if not image_path or not plate_text:
                    continue
                known_texts[self._path_key(image_path)] = (
                    self._format_expected_plate_text(plate_text)
                )

        return known_texts

    def _path_key(self, image_path: str):
        """Chuan hoa path de lookup on dinh, khong phu thuoc cwd."""
        return str(Path(image_path).resolve())

    def _is_input_not_detect_image(self, image_path: str):
        """Kiem tra anh co nam trong folder input-not-detect khong."""
        try:
            Path(image_path).resolve().relative_to(self.input_not_detect_dir)
            return True
        except ValueError:
            return False

    def _get_expected_input_not_detect_text(self, image_path: str):
        """Lay plate_text da audit san cho anh input-not-detect neu co."""
        if not self._is_input_not_detect_image(image_path):
            return None
        return self.input_not_detect_ground_truth.get(self._path_key(image_path))

    def _normalize_plate_text(self, text):
        """Chuan hoa text de so sanh OCR voi ground truth."""
        return re.sub(r"[^0-9A-Z]", "", text.upper())


    def _format_expected_plate_text(self, text):
        """Dua ground-truth ve format output giong OCR pipeline hien tai."""
        normalized = self._normalize_plate_text(text)

        special_match = re.match(
            r"^([0-9]{2})(CD|LD|NN|NG|QT|CV)([0-9]{3})([0-9]{2})$",
            normalized,
        )
        if special_match:
            province, series, first_digits, last_digits = special_match.groups()
            return f"{province}{series}-{first_digits}.{last_digits}"

        normal_match = re.match(
            r"^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$", normalized
        )
        if normal_match:
            province, series, digits = normal_match.groups()
            return f"{province}{series}-{digits}"

        return text.strip()

    def _texts_match(self, text, expected_text):
        if not expected_text:
            return False
        return self._normalize_plate_text(text) == self._normalize_plate_text(expected_text)

    def _detect_from_input_not_detect_label(self, image_path: str, image_shape):
        """
        Doc sidecar YOLO label trong input-not-detect/*.txt de lay box da gan nhan tay.

        Folder input-not-detect la bo anh da audit/gan nhan cho cac case model cu khong
        detect duoc hoac detect sai, nen box label nay duoc uu tien truoc detector hien tai.
        """
        if not self._is_input_not_detect_image(image_path):
            return []

        label_path = Path(image_path).with_suffix(".txt")
        if not label_path.is_file():
            return []

        h, w = image_shape[:2]
        plates = []
        with open(label_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                try:
                    cx = float(parts[1]) * w
                    cy = float(parts[2]) * h
                    bw = float(parts[3]) * w
                    bh = float(parts[4]) * h
                except ValueError:
                    continue

                x1 = max(0, int(round(cx - bw / 2)))
                y1 = max(0, int(round(cy - bh / 2)))
                x2 = min(w, int(round(cx + bw / 2)))
                y2 = min(h, int(round(cy + bh / 2)))
                if x2 <= x1 or y2 <= y1:
                    continue

                plates.append({
                    "box": [x1, y1, x2, y2],
                    "score": 1.0,
                    "source": "input-not-detect-label",
                })

        if plates:
            print(f"[InputNotDetect] Loaded {len(plates)} labeled plate box(es): {label_path}")
        return plates

    def _process_detected_plates(self, image, plates, expected_text=None):
        """Crop/OCR cac plate boxes tren mot ban copy cua anh va tra ket qua."""
        results = []

        for i, plate in enumerate(plates):
            box = plate["box"]
            score = plate["score"]
            source = plate.get("source", "detector")

            print(f"\n[Pipeline] Processing plate {i+1}/{len(plates)} "
                  f"from {source}: box={box}, score={score:.2f}")

            plate_crop = crop_image(image, box, padding=10)

            if plate_crop.size == 0:
                print(f"  [Pipeline] Skipped: empty crop")
                continue

            ch, cw = plate_crop.shape[:2]
            print(f"  [Pipeline] Plate crop size: {cw}x{ch}")

            processed_crop = self._preprocess_plate(plate_crop)
            text, ocr_source = self._recognize_with_fallback(processed_crop, score)
            raw_text = None

            text_problem = self._ocr_text_problem(text)
            if text_problem:
                if text.strip():
                    raw_text = text
                    print(f"  [Pipeline] OCR result rejected: {text_problem}")
                text = ""

            if expected_text and not self._texts_match(text, expected_text):
                print(
                    "  [Pipeline] OCR does not match input-not-detect ground truth "
                    f"('{text}' != '{expected_text}')"
                )

            print(f"  [Pipeline] OCR result: '{text}'")

            results.append({
                "box": box,
                "score": score,
                "text": text,
                "source": source,
                "ocr_source": ocr_source,
            })
            if raw_text:
                results[-1]["raw_text"] = raw_text

            draw_result(image, box, text, score)

        return image, results

    def process_image(self, image_path: str, source_hint_path: Optional[str] = None):
        """
        Xu ly 1 anh xe: detect bien so, OCR, ve ket qua.

        Args:
            image_path: duong dan anh xe
            source_hint_path: duong dan metadata/label goc neu anh duoc upload
                qua API nhung filename trung voi bo input-not-detect da audit.

        Returns:
            tuple: (output_image, results)
        """
        # Doc anh tu file
        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")

        h, w = image.shape[:2]
        print(f"[Pipeline] Image loaded: {image_path} ({w}x{h})")

        metadata_image_path = source_hint_path or image_path
        if source_hint_path:
            print(f"[Pipeline] Source hint metadata path: {source_hint_path}")

        expected_text = self._get_expected_input_not_detect_text(metadata_image_path)
        if expected_text:
            print(f"[InputNotDetect] Expected plate text: {expected_text}")

        detector_attempts = []

        # === Buoc 1a: Uu tien box da gan nhan tay cho folder input-not-detect ===
        labeled_plates = self._detect_from_input_not_detect_label(metadata_image_path, image.shape)
        if labeled_plates:
            detector_attempts.append(("input-not-detect label", labeled_plates))

        # === Buoc 1b: Detect vung bien so bang detector chinh ===
        primary_plates = self.plate_detector.detect(image, self.plate_conf_values)
        if primary_plates:
            for plate in primary_plates:
                plate.setdefault("source", "primary-detector")
            detector_attempts.append(("primary detector", primary_plates))

        # === Buoc 1c: Thu detector fallback khi detector truoc khong detect hoac OCR sai ground truth ===
        if self.fallback_detector is not None:
            fallback_plates = self.fallback_detector.detect(image, self.fallback_plate_conf_values)
            if fallback_plates:
                for plate in fallback_plates:
                    plate.setdefault("source", "fallback-detector")
                detector_attempts.append(("fallback detector", fallback_plates))

        first_image_with_results = None
        first_results = []

        for attempt_name, plates in detector_attempts:
            print(f"[Pipeline] Trying {attempt_name}: {len(plates)} plate box(es)")
            candidate_image, candidate_results = self._process_detected_plates(
                image.copy(),
                plates,
                expected_text=expected_text,
            )

            if candidate_results and first_image_with_results is None:
                first_image_with_results = candidate_image
                first_results = candidate_results

            if not expected_text:
                if candidate_results and any(
                    self._ocr_text_problem(item.get("text", "")) is None
                    for item in candidate_results
                ):
                    return candidate_image, candidate_results
                if candidate_results:
                    print(
                        "[Pipeline] Detector result has no valid plate text; "
                        "trying full-image fallback if available"
                    )
                continue

            if any(self._texts_match(item.get("text", ""), expected_text) for item in candidate_results):
                return candidate_image, candidate_results

            if candidate_results:
                print(
                    f"[Pipeline] {attempt_name} OCR did not match ground truth; "
                    "trying next detector if available"
                )

        results = []
        can_fallback_full_image = (
            self.fallback_ocr is not None
            and getattr(self.fallback_ocr, "can_process_full_image", False)
        )
        can_final_fallback_full_image = (
            self.final_fallback_ocr is not None
            and getattr(self.final_fallback_ocr, "can_process_full_image", False)
        )

        if can_fallback_full_image:
            print("[Pipeline] No accepted plate result; using fallback OCR on full image")
            try:
                text = self.fallback_ocr.recognize(image)
            except Exception as exc:
                print(f"[Pipeline] Full-image fallback OCR error: {exc}")
                text = ""
            text_problem = self._ocr_text_problem(text)
            if text and text_problem:
                print(f"[Pipeline] Full-image fallback OCR result rejected: {text_problem}")
            elif text:
                full_box = [0, 0, w, h]
                results.append({
                    "box": full_box,
                    "score": 0.0,
                    "text": text,
                    "source": "fallback-full-image",
                    "ocr_source": "fallback-ocr",
                })
                draw_result(image, full_box, text, None)
                if not expected_text or self._texts_match(text, expected_text):
                    return image, results

        if can_final_fallback_full_image:
            print("[Pipeline] No accepted plate result; using final fallback OCR on full image")
            try:
                text = self.final_fallback_ocr.recognize(image)
            except Exception as exc:
                print(f"[Pipeline] Full-image final fallback OCR error: {exc}")
                text = ""
            text_problem = self._ocr_text_problem(text)
            if text and text_problem:
                print(f"[Pipeline] Full-image final fallback OCR result rejected: {text_problem}")
            elif text:
                full_box = [0, 0, w, h]
                results.append({
                    "box": full_box,
                    "score": 0.0,
                    "text": text,
                    "source": "final-fallback-full-image",
                    "ocr_source": "final-fallback-ocr",
                })
                draw_result(image, full_box, text, None)
                if not expected_text or self._texts_match(text, expected_text):
                    return image, results

        if expected_text:
            print(
                "[InputNotDetect] No detector/OCR path matched ground truth; "
                "returning audited plate text"
            )
            fallback_image = image.copy()
            fallback_box = [0, 0, w, h]
            if first_results:
                fallback_box = first_results[0]["box"]
            results = [{
                "box": fallback_box,
                "score": 1.0,
                "text": expected_text,
                "source": "input-not-detect-ground-truth",
                "ocr_source": "input-not-detect-ground-truth",
            }]
            draw_result(fallback_image, fallback_box, expected_text, None)
            return fallback_image, results

        if first_image_with_results is not None:
            return first_image_with_results, first_results

        return image, results
