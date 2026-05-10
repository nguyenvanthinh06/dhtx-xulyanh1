# === Module: utils.py ===
# Cac ham tien ich dung chung cho pipeline: crop anh, ve ket qua, tao thu muc.

# cv2 (OpenCV): thu vien xu ly anh
import cv2

# os: thao tac file va thu muc
import os


def crop_image(image, box, padding=5):
    """
    Cat vung bien so tu anh goc, co them padding xung quanh.

    Padding giup dam bao khong cat mat ky tu o ria bien so.
    Toa do duoc clamp ve [0, w] va [0, h] de khong vuot ra ngoai anh.

    Args:
        image: numpy array (BGR) - anh goc
        box: [x1, y1, x2, y2] - toa do bounding box tu YOLO
        padding: int - so pixel mo rong moi phia (mac dinh 5)

    Returns:
        numpy array - anh crop vung bien so
    """
    # Lay kich thuoc anh goc: h = chieu cao, w = chieu rong
    h, w = image.shape[:2]

    # Tach toa do box
    x1, y1, x2, y2 = box

    # Mo rong box them padding pixel moi phia,
    # nhung clamp de khong vuot ra ngoai anh.
    # max(0, ...) dam bao toa do khong am (khong ra ngoai canh trai/tren)
    x1 = max(0, x1 - padding)   # Canh trai: lui them padding, toi thieu 0
    y1 = max(0, y1 - padding)   # Canh tren: lui them padding, toi thieu 0

    # min(w, ...) va min(h, ...) dam bao toa do khong vuot qua kich thuoc anh
    x2 = min(w, x2 + padding)   # Canh phai: tien them padding, toi da w
    y2 = min(h, y2 + padding)   # Canh duoi: tien them padding, toi da h

    # Cat anh bang numpy slicing: image[y1:y2, x1:x2]
    # Tra ve numpy array chua vung bien so
    return image[y1:y2, x1:x2]


def draw_result(image, box, text, score=None):
    """
    Ve bounding box va text bien so len anh.

    Args:
        image: numpy array (BGR) - anh goc (se bi modify in-place)
        box: [x1, y1, x2, y2] - toa do bounding box
        text: str - text bien so (vi du: "30A-12345")
        score: float hoac None - confidence score de hien thi kem

    Returns:
        numpy array - anh da ve (cung la image dau vao, da modify)
    """
    # Tach toa do box
    x1, y1, x2, y2 = box

    # Ve hinh chu nhat (bounding box) mau xanh la.
    # (0, 255, 0) = mau xanh la trong BGR
    # 2 = do day duong ke (pixel)
    cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # Tao label: "text (score)" hoac chi "text" neu khong co score
    label = text
    if score is not None:
        label = f"{text} ({score:.2f})"

    # Ve text len anh, phia tren bounding box
    cv2.putText(
        image,                           # Anh can ve
        label,                           # Noi dung text
        (x1, max(30, y1 - 10)),          # Vi tri: goc tren trai cua box, lui len 10px
                                         # max(30, ...) dam bao text khong bi cat o ria tren anh
        cv2.FONT_HERSHEY_SIMPLEX,        # Font chu
        0.9,                             # Kich co font
        (0, 255, 0),                     # Mau text: xanh la (BGR)
        2,                               # Do day net chu
        cv2.LINE_AA                      # Anti-aliasing: text muot hon
    )

    return image


def ensure_dir(path):
    """
    Tao thu muc neu chua ton tai.

    os.makedirs: tao thu muc va cac thu muc cha (recursive).
    exist_ok=True: khong bao loi neu thu muc da ton tai.

    Args:
        path: str - duong dan thu muc can tao
              Vi du: "output" -> tao thu muc output/
    """
    os.makedirs(path, exist_ok=True)


def parse_confidence_values(value, default=0.25):
    """
    Parse a confidence value or comma-separated list of confidences.
    Returns a normalized list of floats in [0.0, 1.0].
    """
    if value is None:
        return [float(default)]

    if isinstance(value, (float, int)):
        return [max(0.0, min(1.0, float(value)))]

    if isinstance(value, str):
        parts = [item.strip() for item in value.split(",") if item.strip()]
        if not parts:
            return [float(default)]
        values = []
        for part in parts:
            try:
                values.append(max(0.0, min(1.0, float(part))))
            except ValueError:
                raise ValueError(f"Invalid confidence value: {part}")
        return values

    if isinstance(value, (list, tuple)):
        return [max(0.0, min(1.0, float(item))) for item in value]

    raise ValueError(f"Unsupported confidence values type: {type(value).__name__}")