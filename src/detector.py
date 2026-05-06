# === Module: detector.py ===
# Su dung YOLO local hoac Roboflow API de detect vung bien so xe trong anh.
# Day la buoc dau tien trong pipeline:
# Anh xe -> [Detect vung bien so] -> crop -> OCR -> text

# Import YOLO tu ultralytics de load model local
from ultralytics import YOLO

# base64, cv2, requests: dung khi goi Roboflow API
import base64
import cv2
import requests


class PlateDetector:
    """
    Detector bien so xe, ho tro 2 engine:
    1. YOLO local: chay model .pt tren may (nhanh, offline)
    2. Roboflow API: gui anh len cloud (chinh xac hon, can internet)
    """

    def __init__(
        self,
        model_path: str = "models/plate_detector.pt",
        conf: float = 0.25,
        engine: str = "yolo",
        roboflow_api_key: str = None,
        roboflow_model_id: str = "license-plate-recognition-rxg4e/4",
        roboflow_api_url: str = "https://detect.roboflow.com",
        roboflow_timeout: float = 30.0
    ):
        """
        Khoi tao detector.

        Args:
            model_path: duong dan model YOLO (.pt) cho engine "yolo"
            conf: nguong confidence toi thieu (0.0 - 1.0)
            engine: "yolo" (local) hoac "roboflow" (API)
            roboflow_api_key: API key Roboflow (chi can khi engine="roboflow")
            roboflow_model_id: model ID tren Roboflow Universe
            roboflow_api_url: URL API Roboflow
            roboflow_timeout: timeout cho request Roboflow (giay)
        """
        # Luu engine dang dung
        self.engine = engine.lower()

        # Luu nguong confidence
        self.conf = conf

        if self.engine == "yolo":
            # Load model YOLO tu file .pt
            self.model = YOLO(model_path)
            print(f"[Detector] Using YOLO local: {model_path}")

        elif self.engine == "roboflow":
            # Luu cau hinh Roboflow API
            self.api_key = roboflow_api_key
            self.model_id = roboflow_model_id.strip("/")
            self.api_url = roboflow_api_url.rstrip("/")
            self.timeout = roboflow_timeout
            print(f"[Detector] Using Roboflow API: {self.model_id}")

        else:
            raise ValueError(f"Unsupported detector engine: {engine}")

    def detect(self, image):
        """
        Detect vung bien so trong anh.

        Args:
            image: numpy array (BGR) - anh xe nguyen goc

        Returns:
            list[dict] - danh sach bien so, moi dict co:
                - "box": [x1, y1, x2, y2]
                - "score": float (0.0 - 1.0)
        """
        if self.engine == "yolo":
            return self._detect_yolo(image)
        else:
            return self._detect_roboflow(image)

    def _detect_yolo(self, image):
        """Detect bang YOLO local."""
        # Chay YOLO inference tren anh
        results = self.model.predict(image, conf=self.conf, verbose=False)

        plates = []

        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                # Lay toa do box [x1, y1, x2, y2]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)

                # Lay confidence score
                score = float(box.conf[0].cpu().numpy())

                plates.append({
                    "box": [int(x1), int(y1), int(x2), int(y2)],
                    "score": score
                })

        print(f"[YOLO] Detected {len(plates)} license plate(s)")
        return plates

    def _detect_roboflow(self, image):
        """Detect bang Roboflow API (chinh xac hon YOLO local)."""

        # Encode anh thanh base64
        success, buffer = cv2.imencode(".jpg", image)
        if not success:
            raise ValueError("Cannot encode image for Roboflow.")
        image_base64 = base64.b64encode(buffer.tobytes()).decode("utf-8")

        # Gui POST request len Roboflow API
        response = requests.post(
            f"{self.api_url}/{self.model_id}",
            params={
                "api_key": self.api_key,
                "confidence": int(round(self.conf * 100))
            },
            data=image_base64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=self.timeout
        )

        # Kiem tra loi HTTP
        if response.status_code >= 400:
            raise RuntimeError(
                f"Roboflow Detector API error {response.status_code}: "
                f"{response.text[:500]}"
            )

        # Parse JSON response
        try:
            data = response.json()
        except ValueError as exc:
            raise RuntimeError("Roboflow Detector did not return valid JSON.") from exc

        # Chuyen doi predictions sang format chung
        predictions = data.get("predictions", [])
        plates = []

        for pred in predictions:
            try:
                conf = float(pred.get("confidence", 0.0))
                x = float(pred["x"])        # Tam ngang
                y = float(pred["y"])        # Tam doc
                w = float(pred["width"])    # Do rong
                h = float(pred["height"])   # Do cao

                # Chuyen tu (center, size) sang (corners)
                x1 = int(round(x - w / 2))
                y1 = int(round(y - h / 2))
                x2 = int(round(x + w / 2))
                y2 = int(round(y + h / 2))

                plates.append({
                    "box": [x1, y1, x2, y2],
                    "score": conf
                })
            except (KeyError, TypeError, ValueError):
                continue

        print(f"[Roboflow Detector] Detected {len(plates)} license plate(s)")
        return plates