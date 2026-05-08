# Workflow training cho `input-not-detect`

Tài liệu này áp dụng cho hướng bạn chọn:

- **Detect vùng biển**: dùng `labelImg` để label box biển số và train YOLO detector.
- **OCR hướng A**: dùng YOLO character detection, tức là label từng ký tự trên crop biển số.
- **Gemini**: chỉ dùng fallback khi OCR chính rỗng/sai format/confidence thấp hoặc không detect được biển.

## 1. Chuẩn bị dữ liệu hard-case

Tạo folder ảnh khó nếu chưa có:

```bash
mkdir -p input-not-detect
```

Copy các ảnh chưa detect được hoặc OCR sai vào `input-not-detect/`.

Sau đó tạo file ground-truth để điền biển đúng:

```bash
python scripts/dataset/build_ground_truth_template.py \
  --input-dir input-not-detect \
  --output data/ground_truth/input_not_detect.csv
```

Mở `data/ground_truth/input_not_detect.csv` và điền các cột:

| Cột | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `plate_text` | Biển đúng đã format | `89CD-002.13` |
| `issue_type` | Loại lỗi | `no_detect`, `ocr_wrong`, `bad_crop` |
| `plate_type` | Nhóm biển | `normal_car`, `special_cd`, `special_nn` |
| `split` | Tập dữ liệu | `train`, `val`, `test` |
| `note` | Ghi chú | `Roboflow đọc 893D000213` |

## 2. Label vùng biển bằng labelImg

Cài labelImg nếu cần:

```bash
pip install labelImg
labelImg
```

Trong labelImg:

1. Mở folder `input-not-detect`.
2. Chọn format **YOLO**.
3. Load class file: `data/labelimg_classes/plate_classes.txt`.
4. Label một box quanh toàn bộ vùng biển số với class `plate`.
5. Save label `.txt` cùng folder ảnh hoặc vào folder labels riêng.

Class detector chỉ có:

```text
plate
```

## 3. Tạo YOLO dataset cho plate detector

Nếu file `.txt` label nằm cùng folder ảnh:

```bash
python scripts/dataset/split_yolo_dataset.py \
  --images-dir input-not-detect \
  --output-dir data/plate_detection \
  --ground-truth data/ground_truth/input_not_detect.csv
```

Nếu label nằm ở folder riêng:

```bash
python scripts/dataset/split_yolo_dataset.py \
  --images-dir input-not-detect \
  --labels-dir path/to/label-folder \
  --output-dir data/plate_detection \
  --ground-truth data/ground_truth/input_not_detect.csv
```

Dataset sẽ có dạng:

```text
data/plate_detection/
├── images/train
├── images/val
├── images/test
├── labels/train
├── labels/val
├── labels/test
└── data.yaml
```

## 4. Train plate detector

Kiểm tra command trước:

```bash
python scripts/train/train_yolo.py --config config/train/plate_yolo.yaml --dry-run
```

Train thật:

```bash
python scripts/train/train_yolo.py --config config/train/plate_yolo.yaml
```

Model tốt nhất sẽ nằm ở:

```text
experiments/plate_yolo/v1/weights/best.pt
```

Copy model sang `models/`:

```bash
cp experiments/plate_yolo/v1/weights/best.pt models/plate_detector_v2.pt
```

## 5. Crop biển để chuẩn bị OCR hướng A

Dùng label vùng biển đã có để crop ảnh biển số:

```bash
python scripts/dataset/crop_plates_from_yolo.py \
  --dataset-dir data/plate_detection \
  --split train \
  --output-dir data/char_detection/raw_crops
```

Lặp lại cho `val` và `test` nếu cần:

```bash
python scripts/dataset/crop_plates_from_yolo.py --dataset-dir data/plate_detection --split val --output-dir data/char_detection/raw_crops_val
python scripts/dataset/crop_plates_from_yolo.py --dataset-dir data/plate_detection --split test --output-dir data/char_detection/raw_crops_test
```

## 6. Label ký tự OCR bằng labelImg

Mở các crop trong labelImg:

```bash
labelImg data/char_detection/raw_crops data/labelimg_classes/char_classes.txt
```

Chọn format **YOLO** và label từng ký tự.

Ví dụ biển:

```text
89CD-002.13
```

Chỉ label các ký tự:

```text
8 9 C D 0 0 2 1 3
```

**Không label dấu `-` và `.`** vì `PlateFormatter` sẽ tự format theo `config/plate_rules.yaml`.

## 7. Tạo YOLO dataset cho character OCR

Nếu label ký tự `.txt` nằm cùng folder crop:

```bash
python scripts/dataset/split_yolo_dataset.py \
  --images-dir data/char_detection/raw_crops \
  --output-dir data/char_detection
```

Nếu label nằm folder riêng:

```bash
python scripts/dataset/split_yolo_dataset.py \
  --images-dir data/char_detection/raw_crops \
  --labels-dir path/to/char-labels \
  --output-dir data/char_detection
```

## 8. Train YOLO character OCR

Kiểm tra command:

```bash
python scripts/train/train_yolo.py --config config/train/char_yolo.yaml --dry-run
```

Train thật:

```bash
python scripts/train/train_yolo.py --config config/train/char_yolo.yaml
```

Copy model:

```bash
cp experiments/char_yolo/v1/weights/best.pt models/char_detector.pt
```

## 9. Chạy end-to-end với model đã train

Chạy YOLO detector + YOLO OCR, Gemini chỉ fallback:

```bash
python main.py \
  --image input-not-detect/f-1740160764017-693062374.jpg \
  --detect-engine yolo \
  --ocr-engine yolo \
  --plate-model models/plate_detector_v2.pt \
  --char-model models/char_detector.pt \
  --fallback-ocr-engine gemini
```

Với `run.py`:

```bash
py run.py input-not-detect/f-1740160764017-693062374.jpg \
  --detect yolo \
  --ocr yolo \
  --fallback gemini \
  --no-show
```

## 10. Đánh giá lại folder hard-case

Sau khi train, chạy audit:

```bash
python tools/audit_input_folder.py \
  --input-dir input-not-detect \
  --detect-engine yolo \
  --ocr-engine yolo \
  --plate-model models/plate_detector_v2.pt \
  --char-model models/char_detector.pt \
  --fallback-ocr-engine gemini \
  --csv docs/input_not_detect_audit_results.csv \
  --report docs/input_not_detect_audit_report.md
```

Mục tiêu sau mỗi vòng train:

- Giảm `no_plate_detected`.
- Giảm `ocr_empty`.
- Giảm `invalid_format`.
- Giảm tỷ lệ phải dùng Gemini fallback.
- Tăng exact-match với `data/ground_truth/input_not_detect.csv`.

## 11. Vòng lặp cải thiện

1. Chạy audit.
2. Lấy ảnh fail còn lại đưa lại vào `input-not-detect` hoặc cập nhật ground truth.
3. Label thêm vùng biển hoặc ký tự.
4. Train lại detector/OCR.
5. So sánh report trước/sau.
