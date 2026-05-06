# License Plate OCR

Flow hien tai:

Anh xe -> YOLO detect vung bien so -> crop bien so -> Roboflow character detection -> sort ky tu -> tra text bien so.

## Cai dat

```powershell
pip install -r requirements.txt
```

## Cau hinh Roboflow API key

Nen dung bien moi truong de tranh ghi API key truc tiep vao code:

```powershell
$env:ROBOFLOW_API_KEY="API_KEY_CUA_BAN"
```

File `.env.example` chi la mau ten bien moi truong, khong chua key that.

## Chay OCR bang Roboflow

```powershell
python main.py --image input/test.jpg
```

Neu muon truyen key truc tiep qua command line:

```powershell
python main.py --image input/test.jpg --roboflow-api-key "API_KEY_CUA_BAN"
```

Luu y: cach truyen key truc tiep co the luu vao shell history, nen bien moi truong van la cach nen dung.

## Tham so hay dung

Giam confidence khi Roboflow detect thieu ky tu:

```powershell
python main.py --image input/test.jpg --char-conf 0.15
```

Tang confidence khi Roboflow detect nham ky tu:

```powershell
python main.py --image input/test.jpg --char-conf 0.4
```

Thay model OCR Roboflow neu can:

```powershell
python main.py --image input/test.jpg --roboflow-model-id license-plate-ocr-hugcj/3
```

Dung OCR YOLO local cu neu sau nay co file `models/char_detector.pt`:

```powershell
python main.py --image input/test.jpg --ocr-engine yolo --char-model models/char_detector.pt
```

## Cac file moi

- `src/ocr_roboflow.py`: goi Roboflow API de detect tung ky tu tren anh crop bien so.
- `src/character_reader.py`: gom logic chung de sort ky tu theo dong va format thanh text bien so.
- `.env.example`: mau ten bien moi truong `ROBOFLOW_API_KEY`.

## Giai thich code

Xem `docs/roboflow_ocr_explanation.md` de doc giai thich tung dong/nhom dong cua phan tich hop Roboflow.


## Dung Gemini lam OCR fallback

Gemini chi nen dung lam fallback khi OCR chinh bi rong/sai format, confidence detect bien thap, hoac detector khong tim thay bien so. Khi da co `GEMINI_API_KEY` trong `.env`, `run.py` se tu bat fallback Gemini nhung van uu tien OCR Roboflow truoc:

```powershell
py run.py input/f-1740160764017-693062374.jpg --no-show
```

Neu muon bat ro fallback Gemini tu command line:

```powershell
py run.py input/f-1740160764017-693062374.jpg --fallback gemini --no-show
```

Neu muon dung local YOLO de detect vung bien va chi fallback Gemini khi OCR chinh dang nghi:

```powershell
py run.py input/f-1740160764017-693062374.jpg --detect yolo --fallback gemini --no-show
```

Lenh `main.py` tuong duong:

```powershell
python main.py --image input/f-1740160764017-693062374.jpg --fallback-ocr-engine gemini --gemini-api-key "API_KEY_GEMINI_CUA_BAN"
```

Gemini OCR se gui anh crop bien so len Gemini Vision API, yeu cau model tra ve text bien so, roi van di qua `config/plate_rules.yaml` de format lai thanh dang nhu `89CD-002.13`.

## Audit toàn bộ folder input

Dùng script audit để thống kê ảnh không detect được biển số, OCR rỗng, OCR sai format biển số Việt Nam hoặc confidence thấp:

```powershell
python tools/audit_input_folder.py --input-dir input --detect-engine roboflow --ocr-engine roboflow
```

Kết quả mặc định:

- `docs/input_audit_results.csv`: chi tiết từng ảnh.
- `docs/input_audit_report.md`: thống kê tổng hợp và danh sách ảnh cần xử lý lại.

Có thể chạy thử nhanh vài ảnh trước:

```powershell
python tools/audit_input_folder.py --input-dir input --limit 20
```

Nếu muốn chỉ kiểm tra detect vùng biển và chưa gọi OCR:

```powershell
python tools/audit_input_folder.py --input-dir input --ocr-engine none
```
