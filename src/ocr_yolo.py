# === Module: ocr_yolo.py ===
# OCR engine backup su dung YOLO local de detect ky tu tren anh bien so.
# Dung khi co file model YOLO char_detector.pt rieng.
# Ke thua CharacterReader de dung chung logic sort va format.

# Import YOLO tu ultralytics de load va chay model detect ky tu
from ultralytics import YOLO

# CharacterReader: class cha cung cap recognize(), sort, format
from src.character_reader import CharacterReader


class YoloCharacterOCR(CharacterReader):
    """
    OCR engine su dung model YOLO local de detect tung ky tu.
    
    Khac voi RoboflowCharacterOCR (gui anh len API), engine nay
    chay model tren may local -> nhanh hon, khong can internet,
    nhung can co file model .pt duoc train rieng cho ky tu bien so.
    """

    def __init__(
        self,
        model_path: str,                                   # Duong dan model YOLO detect ky tu
        conf: float = 0.25,                                # Nguong confidence
        config_path: str = "config/plate_rules.yaml"       # File rule format bien so
    ):
        # Goi constructor class cha de nap PlateFormatter
        super().__init__(config_path)

        # Load model YOLO detect ky tu tu file .pt
        # Vi du: "models/char_detector.pt"
        self.model = YOLO(model_path)

        # Luu nguong confidence
        self.conf = conf

    def detect_chars(self, plate_image):
        """
        Detect tung ky tu tren anh crop bien so bang YOLO local.

        Args:
            plate_image: numpy array (BGR) - anh crop vung bien so

        Returns:
            list[dict] - danh sach ky tu, moi dict co:
                - "char": str - ky tu detect duoc
                - "box": [x1, y1, x2, y2] - toa do bounding box
                - "score": float - confidence score
                - "cx", "cy": float - tam box
                - "height", "width": float - kich thuoc box
        """
        # Chay YOLO predict tren anh crop bien so
        # verbose=False: tat log chi tiet
        results = self.model.predict(plate_image, conf=self.conf, verbose=False)

        # Tao list chua cac ky tu
        chars = []

        # Duyet tung result (thuong chi co 1 vi predict 1 anh)
        for result in results:
            # Lay mapping tu class_id -> class_name
            # Vi du: {0: "0", 1: "1", ..., 10: "A", 11: "B", ...}
            names = result.names

            # Kiem tra co box nao khong
            if result.boxes is None:
                continue

            # Duyet tung bounding box
            for box in result.boxes:
                # Lay toa do box dang xyxy: [x1, y1, x2, y2]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)

                # Lay class ID cua ky tu
                cls_id = int(box.cls[0].cpu().numpy())

                # Lay confidence score
                score = float(box.conf[0].cpu().numpy())

                # Chuyen class ID sang ten ky tu
                # Vi du: cls_id=10 -> names[10]="A"
                label = str(names[cls_id])

                # Tao dict ky tu theo format chung
                chars.append({
                    "char": label,                     # Ky tu
                    "box": [x1, y1, x2, y2],           # Toa do box
                    "score": score,                    # Do tin cay
                    "cx": (x1 + x2) / 2,              # Tam ngang (trung binh x1 va x2)
                    "cy": (y1 + y2) / 2,              # Tam doc (trung binh y1 va y2)
                    "height": y2 - y1,                 # Chieu cao box
                    "width": x2 - x1                   # Chieu rong box
                })

        return chars
