# === Module: ocr_gemini.py ===
# OCR engine su dung Gemini Vision API de doc bien so tu anh crop hoac anh xe.
# Khac voi Roboflow/Yolo character detector, Gemini tra ve text truc tiep.

import base64
import os
import re

import cv2
import requests

from src.plate_formatter import PlateFormatter


class GeminiPlateOCR:
    """
    OCR engine dung Gemini API nhu mot fallback khi OCR ky tu bi sai.

    Engine nay nhan anh crop bien so (hoac anh full xe khi detector khong tim
    thay bien), gui len Gemini generateContent voi inline image data, yeu cau
    model chi tra ve text bien so Viet Nam. Text raw sau do duoc chuan hoa va
    dua qua PlateFormatter de ap dung cac rule nhu 89CD-002.13.
    """

    def __init__(
        self,
        api_key: str = None,
        model_id: str = "gemini-2.5-flash",
        api_url: str = "https://generativelanguage.googleapis.com/v1beta",
        config_path: str = "config/plate_rules.yaml",
        timeout: float = 30.0,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Missing Gemini API key. Set GEMINI_API_KEY or pass --gemini-api-key."
            )

        self.model_id = model_id.strip("/")
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.formatter = PlateFormatter(config_path)

        # Bao cho pipeline biet engine nay co the doc truc tiep tren anh full
        # neu detector khong tim thay vung bien so.
        self.can_process_full_image = True

    def recognize(self, plate_image):
        """Doc text bien so tu anh va format thanh bien so chuan."""
        raw_text = self._infer(plate_image)
        plate_raw = self._extract_plate(raw_text)
        print(f"  [Gemini] Raw response: {raw_text!r}")
        print(f"  [Gemini] Extracted plate: {plate_raw!r}")

        if not plate_raw:
            return ""

        return self.formatter.format([list(plate_raw)])

    def _infer(self, image):
        image_base64 = self._encode_image(image)
        prompt = (
            "Bạn là OCR chuyên đọc biển số xe Việt Nam. "
            "Hãy đọc duy nhất biển số chính trong ảnh. "
            "Trả về chỉ một dòng text biển số, không giải thích. "
            "Giữ chữ cái như CD, LD, NN, NG, QT, CV nếu có. "
            "Nếu biển có dạng đặc biệt như 89CD-002.13 thì có thể trả về "
            "89CD-002.13 hoặc 89CD00213. "
            "Nếu không thấy biển số, trả về chuỗi rỗng."
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_base64,
                            }
                        },
                        {"text": prompt},
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 32,
            },
        }

        response = requests.post(
            f"{self.api_url}/models/{self.model_id}:generateContent",
            params={"key": self.api_key},
            json=payload,
            timeout=self.timeout,
        )

        if response.status_code >= 400:
            raise RuntimeError(
                f"Gemini API error {response.status_code}: {response.text[:500]}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("Gemini API did not return valid JSON.") from exc

        return self._response_text(data)

    def _encode_image(self, image):
        success, buffer = cv2.imencode(".jpg", image)
        if not success:
            raise ValueError("Cannot encode image for Gemini OCR.")
        return base64.b64encode(buffer.tobytes()).decode("utf-8")

    def _response_text(self, data):
        texts = []
        for candidate in data.get("candidates", []):
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                text = part.get("text")
                if text:
                    texts.append(text.strip())
        return "\n".join(texts).strip()

    def _extract_plate(self, text):
        """
        Lay bien so kha di nhat tu response Gemini.

        Gemini co the tra ve san dau '-' va '.', nhung formatter can raw chars,
        nen ham nay loai bo ky tu khong phai A-Z/0-9 truoc khi format.
        """
        normalized = re.sub(r"[^0-9A-Za-z]", "", text).upper()
        matches = re.findall(r"[0-9]{2}[A-Z]{1,2}[0-9]{4,6}", normalized)
        if matches:
            return matches[0]
        return normalized
