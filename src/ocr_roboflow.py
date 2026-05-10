# === Module: ocr_roboflow.py ===
# Tich hop Roboflow API de detect tung ky tu tren anh crop bien so xe.
# Ke thua CharacterReader de dung chung logic sort ky tu va format text.

# --- Import cac thu vien can thiet ---

# base64: dung de chuyen anh JPEG thanh chuoi base64 truoc khi gui len Roboflow API
import base64

# cv2 (OpenCV): dung de encode anh numpy array thanh dinh dang JPEG
import cv2

# requests: thu vien HTTP, dung de goi Roboflow API qua giao thuc POST
import requests

# CharacterReader: class cha cung cap logic recognize(), sort ky tu theo dong,
# va format text bien so. Class nay chi can override detect_chars().
from src.character_reader import CharacterReader


class RoboflowCharacterOCR(CharacterReader):
    """
    OCR engine su dung Roboflow API de detect tung ky tu tren anh bien so.
    
    Flow:
    1. Nhan anh crop bien so (numpy array tu OpenCV)
    2. Encode anh thanh base64
    3. Gui len Roboflow API qua HTTP POST
    4. Nhan JSON response chua danh sach cac ky tu va vi tri cua chung
    5. Chuyen doi format Roboflow (center-x, center-y, width, height) 
       sang format chung cua du an (x1, y1, x2, y2)
    6. Tra danh sach ky tu cho class cha xu ly tiep (sort + format)
    """

    def __init__(
        self,
        api_key: str,                                     # API key Roboflow de xac thuc
        model_id: str = "license-plate-ocr-hugcj/3",      # ID model + version tren Roboflow
        api_url: str = "https://detect.roboflow.com",      # URL goc cua Roboflow Detect API
        conf: float = 0.25,                                # Nguong confidence toi thieu (0.0 - 1.0)
        config_path: str = "config/plate_rules.yaml",      # File cau hinh rule format bien so VN
        timeout: float = 30.0,                             # Thoi gian cho toi da cho 1 request (giay)
        debug: bool = False                                # In chi tiet char detect de debug
    ):
        # Goi constructor cua class cha (CharacterReader) de nap PlateFormatter
        # tu file config. PlateFormatter chiu trach nhiem format text bien so
        # theo cac regex rule (vi du: "30A-12345").
        super().__init__(config_path, debug=debug)

        # Luu API key de dung khi gui request len Roboflow.
        # Key nay duoc truyen tu CLI (--roboflow-api-key) hoac bien moi truong.
        self.api_key = api_key

        # Loai bo dau "/" thua o dau/cuoi model_id de tranh loi khi noi URL.
        # Vi du: "/license-plate-ocr-hugcj/3/" -> "license-plate-ocr-hugcj/3"
        self.model_id = model_id.strip("/")

        # Loai bo dau "/" o cuoi api_url de khi noi voi model_id khong bi "//".
        # Vi du: "https://detect.roboflow.com/" -> "https://detect.roboflow.com"
        self.api_url = api_url.rstrip("/")

        # Xu ly confidence: chap nhan ca 2 dang input.
        # Neu nguoi dung truyen 25 (thang 0-100), doi thanh 0.25 (thang 0-1).
        # Neu nguoi dung truyen 0.25 thi giu nguyen.
        normalized_conf = conf if conf <= 1 else conf / 100

        # Dam bao confidence nam trong khoang hop le [0.0, 1.0].
        # max(0.0, ...) ngan gia tri am, min(1.0, ...) ngan gia tri > 1.
        self.conf = max(0.0, min(1.0, normalized_conf))

        # Luu timeout de tranh request HTTP treo vinh vien.
        self.timeout = timeout

    def detect_chars(self, plate_image):
        """
        Ham chinh: nhan anh crop bien so, tra ve danh sach ky tu da detect.

        Input:
            plate_image: numpy array (BGR) - anh crop vung bien so tu YOLO.

        Output:
            list[dict] - moi dict chua:
                - "char": ky tu detect duoc (vi du: "3", "A", "5")
                - "box": [x1, y1, x2, y2] toa do goc tren trai va goc duoi phai
                - "score": do tin cay cua detection (0.0 - 1.0)
                - "cx", "cy": toa do tam cua ky tu (dung de sort theo dong)
                - "height", "width": kich thuoc box (dung de phan biet dong)
        """
        # Buoc 1: Gui anh len Roboflow API va nhan JSON response
        payload = self._infer(plate_image)

        # Buoc 2: Lay danh sach predictions tu JSON.
        # Neu Roboflow khong detect duoc gi, tra ve list rong.
        predictions = payload.get("predictions", [])

        # In ra so ky tu Roboflow detect duoc, giup debug khi ket qua sai
        print(f"  [Roboflow] Detected {len(predictions)} characters")

        # Tao list chua cac ky tu da chuan hoa
        chars = []

        # Buoc 3: Duyet tung detection cua Roboflow
        for prediction in predictions:
            # Chuyen doi format Roboflow sang format chung cua du an
            char = self._prediction_to_char(prediction)

            # Chi nhan detection hop le (khong None)
            if char is not None:
                # In chi tiet tung ky tu de debug: ky tu gi, confidence bao nhieu
                print(f"    char='{char['char']}' conf={char['score']:.2f} "
                      f"pos=({char['cx']:.0f},{char['cy']:.0f})")

                # Them ky tu hop le vao danh sach
                chars.append(char)

        # Tra danh sach ky tu cho class cha (CharacterReader)
        # de sort theo dong va format thanh text bien so.
        return chars

    def _infer(self, plate_image):
        """
        Gui anh crop bien so len Roboflow API va nhan JSON response.

        Roboflow Inference API dang POST:
        - URL: {api_url}/{model_id} (vi du: https://detect.roboflow.com/license-plate-ocr-hugcj/3)
        - Body: anh base64
        - Params: api_key, confidence (thang 0-100)

        Response JSON mau:
        {
            "predictions": [
                {"class": "3", "confidence": 0.95, "x": 50, "y": 30, "width": 20, "height": 40},
                {"class": "A", "confidence": 0.88, "x": 75, "y": 30, "width": 22, "height": 40},
                ...
            ]
        }
        """
        # Chuyen anh numpy array sang chuoi base64
        image_base64 = self._encode_image(plate_image)

        # Gui POST request len Roboflow API
        response = requests.post(
            # Tao URL day du: host + model_id
            # Vi du: "https://detect.roboflow.com/license-plate-ocr-hugcj/3"
            f"{self.api_url}/{self.model_id}",

            # Query parameters gui kem URL
            params={
                # API key de Roboflow xac thuc request
                "api_key": self.api_key,

                # Confidence threshold: Roboflow nhan thang 0-100 (so nguyen).
                # Nhan self.conf (0-1) voi 100 va lam tron thanh int.
                # Vi du: 0.25 -> 25
                "confidence": int(round(self.conf * 100))
            },

            # Body chua anh base64
            data=image_base64,

            # Header bao cho Roboflow biet body la du lieu form/base64
            headers={"Content-Type": "application/x-www-form-urlencoded"},

            # Timeout: neu Roboflow khong tra loi sau N giay thi bao loi
            timeout=self.timeout
        )

        # Kiem tra ma HTTP response. >= 400 la loi (401, 403, 404, 500, ...)
        if response.status_code >= 400:
            # Bao loi kem ma HTTP va noi dung response (cat 500 ky tu dau).
            # Khong in API key de bao mat.
            raise RuntimeError(
                f"Roboflow API error {response.status_code}: {response.text[:500]}"
            )

        # Parse JSON response thanh dict Python
        try:
            return response.json()
        except ValueError as exc:
            # Bat truong hop Roboflow tra ve noi dung khong phai JSON hop le
            raise RuntimeError("Roboflow API did not return valid JSON.") from exc

    def _encode_image(self, plate_image):
        """
        Chuyen anh OpenCV (numpy array BGR) thanh chuoi base64.

        Flow:
        1. cv2.imencode(".jpg", ...) chuyen numpy array sang bytes JPEG
        2. base64.b64encode(...) chuyen bytes JPEG sang bytes base64
        3. .decode("utf-8") chuyen bytes base64 sang string de gui trong HTTP body
        """
        # Encode anh numpy array thanh buffer JPEG.
        # success: True/False cho biet encode thanh cong hay khong.
        # buffer: numpy array chua bytes JPEG.
        success, buffer = cv2.imencode(".jpg", plate_image)

        # Kiem tra neu encode that bai (vi du: anh rong, anh hong)
        if not success:
            raise ValueError("Cannot encode plate crop for Roboflow OCR.")

        # Chuyen doi: numpy buffer -> bytes Python -> base64 bytes -> string UTF-8
        # Vi du: anh JPEG -> b'\xff\xd8...' -> b'/9j/...' -> "/9j/..."
        return base64.b64encode(buffer.tobytes()).decode("utf-8")

    def _prediction_to_char(self, prediction):
        """
        Chuyen doi 1 detection cua Roboflow sang format chung cua du an.

        Roboflow tra ve moi ky tu dang:
        {
            "class": "A",
            "confidence": 0.95,
            "x": 50,        <- tam ngang cua box
            "y": 30,        <- tam doc cua box
            "width": 20,    <- do rong box
            "height": 40    <- do cao box
        }

        Du an can format:
        {
            "char": "A",
            "box": [x1, y1, x2, y2],   <- goc tren trai va goc duoi phai
            "score": 0.95,
            "cx": 50, "cy": 30,        <- tam box, dung de sort theo dong va cot
            "height": 40, "width": 20   <- kich thuoc box
        }
        """
        try:
            # Lay confidence score cua detection (0.0 - 1.0)
            score = float(prediction.get("confidence", 0.0))

            # Lay ten class (ky tu): "3", "A", "B", ...
            # Roboflow co the tra "class" hoac "class_name" tuy version API
            label = str(
                prediction.get("class", prediction.get("class_name", ""))
            ).strip()

            # Lay toa do tam (x, y) va kich thuoc (width, height) cua bounding box
            x = float(prediction["x"])          # Toa do tam ngang
            y = float(prediction["y"])          # Toa do tam doc
            width = float(prediction["width"])  # Chieu rong box
            height = float(prediction["height"])  # Chieu cao box

        except (KeyError, TypeError, ValueError):
            # Neu thieu field hoac sai kieu du lieu thi bo qua detection nay
            return None

        # Bo qua ky tu co confidence thap hon nguong, hoac khong co label
        if score < self.conf or not label:
            return None

        # === Chuyen doi toa do tu dang (center, size) sang dang (corners) ===
        # Roboflow: (x=tam, y=tam, width, height)
        # Can chuyen sang: (x1=trai, y1=tren, x2=phai, y2=duoi)

        # x1 = tam_ngang - nua_rong (goc tren trai)
        x1 = int(round(x - width / 2))

        # y1 = tam_doc - nua_cao (goc tren trai)
        y1 = int(round(y - height / 2))

        # x2 = tam_ngang + nua_rong (goc duoi phai)
        x2 = int(round(x + width / 2))

        # y2 = tam_doc + nua_cao (goc duoi phai)
        y2 = int(round(y + height / 2))

        # Tra dict ky tu theo format chung de CharacterReader sort va format
        return {
            "char": label,                  # Ky tu detect duoc
            "box": [x1, y1, x2, y2],       # Toa do bounding box
            "score": score,                 # Do tin cay
            "cx": x,                        # Tam ngang (dung de sort trai-phai)
            "cy": y,                        # Tam doc (dung de phan biet dong)
            "height": height,               # Chieu cao (dung de tinh threshold dong)
            "width": width                  # Chieu rong
        }
