# Giai thich tich hop Roboflow OCR - chi tiet tung dong code

## Tong quan flow xu ly

```
Anh xe
  |
  v
[1] YOLO detect vung bien so (src/detector.py)
  |
  v
[2] Crop vung bien so + padding (src/utils.py)
  |
  v
[3] Roboflow API detect tung ky tu (src/ocr_roboflow.py)
  |
  v
[4] Sort ky tu theo dong va cot (src/character_reader.py)
  |
  v
[5] Format text theo regex rule (src/plate_formatter.py)
  |
  v
Ket qua: "72A-05747"
```

---

## `main.py` - Entry point

- `import argparse`: parse tham so dong lenh.
- `import cv2`: doc/ghi anh.
- `from src.pipeline import LicensePlatePipeline`: class chinh dieu phoi toan bo flow.
- `from src.utils import ensure_dir`: tao thu muc output.
- `parser.add_argument("--image", required=True)`: anh dau vao, bat buoc.
- `parser.add_argument("--output", default="output/result.jpg")`: anh ket qua.
- `parser.add_argument("--plate-model", default="models/plate_detector.pt")`: model YOLO detect bien so.
- `parser.add_argument("--char-model", default=None)`: model YOLO detect ky tu (backup).
- `parser.add_argument("--plate-conf", type=float, default=0.25)`: nguong conf detect bien so.
- `parser.add_argument("--char-conf", type=float, default=0.25)`: nguong conf detect ky tu.
- `parser.add_argument("--ocr-engine", choices=["roboflow", "yolo"], default="roboflow")`: chon engine OCR.
- `parser.add_argument("--roboflow-api-key", default=None)`: API key Roboflow.
- `parser.add_argument("--roboflow-model-id", default="license-plate-ocr-hugcj/3")`: model OCR tren Roboflow.
- `parser.add_argument("--roboflow-api-url", default="https://detect.roboflow.com")`: URL API.
- `parser.add_argument("--roboflow-timeout", type=float, default=30.0)`: timeout request.
- `parser.add_argument("--config", default="config/plate_rules.yaml")`: file rule format.
- `pipeline = LicensePlatePipeline(...)`: tao pipeline voi tat ca tham so.
- `output_image, results = pipeline.process_image(args.image)`: chay toan bo flow.
- `ensure_dir("output")`: tao thu muc output neu chua co.
- `cv2.imwrite(args.output, output_image)`: luu anh ket qua.
- `for item in results:`: duyet va in tung bien so detect duoc.

---

## `src/pipeline.py` - Dieu phoi flow

### `__init__`
- `self.plate_detector = PlateDetector(...)`: tao YOLO detector cho VUNG bien so (buoc 1).
- `self.ocr = self._build_ocr(...)`: tao OCR engine cho KY TU (buoc 3-5).

### `_build_ocr` - Factory method
- `api_key = roboflow_api_key or os.getenv("ROBOFLOW_API_KEY")`: uu tien key tu CLI, fallback bien moi truong.
- `return RoboflowCharacterOCR(...)`: khi `--ocr-engine roboflow`.
- `return YoloCharacterOCR(...)`: khi `--ocr-engine yolo`.

### `process_image` - Xu ly 1 anh
- `image = cv2.imread(image_path)`: doc anh xe.
- `plates = self.plate_detector.detect(image)`: **buoc 1** - YOLO detect vung bien so.
- `plate_crop = crop_image(image, box, padding=10)`: **buoc 2** - crop bien so tu anh goc.
- `text = self.ocr.recognize(plate_crop)`: **buoc 3-5** - OCR -> sort -> format.
- `draw_result(image, box, text, score)`: ve box va text len anh output.

---

## `src/detector.py` - YOLO detect bien so (Buoc 1)

- `from ultralytics import YOLO`: import YOLO tu ultralytics.
- `self.model = YOLO(model_path)`: load model YOLO tu file .pt.
- `results = self.model.predict(image, conf=self.conf, verbose=False)`: chay inference.
- `x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)`: lay toa do box.
  - `.xyxy[0]`: lay box dau tien, format [x1, y1, x2, y2].
  - `.cpu()`: chuyen tu GPU sang CPU.
  - `.numpy()`: chuyen tu tensor sang numpy array.
  - `.astype(int)`: lam tron thanh so nguyen pixel.
- `score = float(box.conf[0].cpu().numpy())`: lay confidence score.
- `plates.append({"box": ..., "score": ...})`: luu ket qua.

---

## `src/ocr_roboflow.py` - Roboflow OCR (Buoc 3)

### `__init__` - Khoi tao Roboflow engine
- `super().__init__(config_path)`: goi class cha nap PlateFormatter.
- `self.api_key = api_key`: luu API key.
- `self.model_id = model_id.strip("/")`: bo dau "/" thua de URL khong bi sai.
- `self.api_url = api_url.rstrip("/")`: bo dau "/" cuoi host.
- `normalized_conf = conf if conf <= 1 else conf / 100`: chap nhan ca `0.25` va `25`.
- `self.conf = max(0.0, min(1.0, normalized_conf))`: clamp ve [0, 1].
- `self.timeout = timeout`: luu timeout.

### `detect_chars` - Detect ky tu
- `payload = self._infer(plate_image)`: goi Roboflow API.
- `predictions = payload.get("predictions", [])`: lay danh sach detection.
- `char = self._prediction_to_char(prediction)`: doi format Roboflow -> format chung.
- `chars.append(char)`: them ky tu hop le vao list.

### `_infer` - Goi Roboflow API
- `image_base64 = self._encode_image(plate_image)`: encode anh thanh base64.
- `response = requests.post(...)`: gui POST request.
  - URL: `{api_url}/{model_id}` → `https://detect.roboflow.com/license-plate-ocr-hugcj/3`.
  - `params={"api_key": ..., "confidence": int(round(self.conf * 100))}`: confidence thang 0-100.
  - `data=image_base64`: body chua anh base64.
  - `headers={"Content-Type": "application/x-www-form-urlencoded"}`: bao Roboflow body la base64.
  - `timeout=self.timeout`: timeout request.
- `response.json()`: parse JSON response.

### `_encode_image` - Encode anh
- `cv2.imencode(".jpg", plate_image)`: numpy array -> bytes JPEG.
- `base64.b64encode(buffer.tobytes()).decode("utf-8")`: bytes JPEG -> string base64.

### `_prediction_to_char` - Chuyen doi format
- Roboflow tra ve: `{class, confidence, x, y, width, height}` (dang tam + kich thuoc).
- Du an can: `{char, box=[x1,y1,x2,y2], score, cx, cy, height, width}` (dang goc + tam).
- `x1 = int(round(x - width / 2))`: tam_ngang - nua_rong = goc tren trai.
- `y1 = int(round(y - height / 2))`: tam_doc - nua_cao = goc tren trai.
- `x2 = int(round(x + width / 2))`: tam_ngang + nua_rong = goc duoi phai.
- `y2 = int(round(y + height / 2))`: tam_doc + nua_cao = goc duoi phai.

---

## `src/character_reader.py` - Sort ky tu (Buoc 4)

### `recognize` - Ham chinh
- `chars = self.detect_chars(plate_image)`: goi engine con (Roboflow/YOLO).
- `rows = self.group_chars_to_rows(chars)`: gom ky tu thanh dong.
- `text = self.formatter.format(rows)`: format thanh text bien so.

### `group_chars_to_rows` - Gom dong
- Khong hard-code 1 dong hay 2 dong. Logic dynamic:
  1. Sort theo `cy` (tren xuong duoi).
  2. Tinh `avg_height` = chieu cao trung binh cua ky tu.
  3. `threshold = avg_height * row_threshold_ratio` (0.65).
  4. 2 ky tu co `|cy1 - cy2| <= threshold` → cung dong.
  5. 2 ky tu co `|cy1 - cy2| > threshold` → khac dong.
  6. Sort dong tu tren xuong duoi.
  7. Trong moi dong, sort ky tu tu trai sang phai theo `cx`.

Vi du bien 2 dong `72A-05747`:
```
Dong 1: 7(cx=256,cy=154) 2(cx=376,cy=158) A(cx=494,cy=160)  → "72A"
Dong 2: 0(cx=134,cy=358) 5(cx=247,cy=359) 7(cx=359,cy=358) 4(cx=500,cy=363) 7(cx=609,cy=364)  → "05747"
threshold = 40 * 0.65 = 26
|358 - 154| = 204 > 26 → khac dong ✓
```

---

## `src/plate_formatter.py` - Format text (Buoc 5)

### `format` - Ap dung rule
1. Gom tung dong thanh chuoi: `[["7","2","A"], ["0","5","7","4","7"]]` → `["72A", "05747"]`.
2. Gom tat ca thanh 1 chuoi: `"72A05747"`.
3. Normalize: upper case + loai bo ky tu la.
4. Thu tung rule theo thu tu:
   - **regex** `^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$`: match "72A05747" → "72A-05747".
   - **two_rows**: match dong tren "72A" + dong duoi "05747" → "72A-05747".
   - **fallback**: tra ve text goc.

### Vi du match:
```
raw = "72A05747"
pattern = "^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$"
groups = ("72", "A", "05747")
output = "{1}{2}-{3}" → "72A-05747"
```

---

## `src/utils.py` - Tien ich

- `crop_image(image, box, padding)`: cat vung bien so tu anh goc, co padding.
  - `x1 = max(0, x1 - padding)`: clamp de khong ra ngoai anh.
  - `image[y1:y2, x1:x2]`: numpy slicing cat vung anh.
- `draw_result(image, box, text, score)`: ve box va text len anh.
  - `cv2.rectangle(...)`: ve hinh chu nhat xanh la.
  - `cv2.putText(...)`: ve text phia tren box.
- `ensure_dir(path)`: tao thu muc neu chua ton tai.

---

## `config/plate_rules.yaml` - Rule format

```yaml
layout:
  row_threshold_ratio: 0.65      # Nguong gom dong: 65% chieu cao tb
  min_chars_for_two_rows: 5      # So ky tu toi thieu de xet 2 dong

rules:
  - name: "vn_car_1_line_8_chars"
    type: "regex"
    pattern: "^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$"  # Match: 30A12345
    output: "{1}{2}-{3}"                                # Output: 30A-12345

  - name: "vn_car_2_line"
    type: "two_rows"
    top_pattern: "^([0-9]{2})([A-Z]{1,2})$"     # Dong tren: 30A
    bottom_pattern: "^([0-9]{4,5})$"             # Dong duoi: 12345
    output: "{top}-{bottom}"                      # Output: 30A-12345

  - name: "fallback"
    type: "fallback"
    output: "{raw}"                               # Tra ve text goc
```
