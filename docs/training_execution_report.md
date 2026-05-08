# Báo cáo thực hiện 13 bước training

Ngày chạy trong môi trường này: 2026-05-08 UTC.

## Kết luận nhanh

Đã chạy các bước tự động có thể chạy được trong repo. Tuy nhiên, trong môi trường hiện tại folder `input-not-detect/` chưa có ảnh thật để label/train, nên các bước cần dữ liệu và thao tác GUI labelImg chưa thể hoàn tất thay bạn.

Các bước đã chuẩn bị xong:

- Cấu trúc dataset YOLO cho plate detector và character OCR.
- File class cho labelImg.
- Template ground-truth CSV.
- Script split dataset YOLO.
- Script crop plate từ YOLO labels.
- Script train YOLO từ config.
- Dry-run command train plate detector và char detector.

## Trạng thái từng bước

| # | Bước | Trạng thái | Ghi chú |
|---|------|------------|---------|
| 1 | Copy ảnh fail vào `input-not-detect/` | Chờ dữ liệu | Folder hiện chỉ có `.gitkeep`, chưa có ảnh thật. |
| 2 | Tạo ground-truth CSV | Đã chạy | `data/ground_truth/input_not_detect.csv` hiện chỉ có header vì chưa có ảnh. |
| 3 | Label vùng biển bằng labelImg | Cần thao tác thủ công | Cần mở labelImg GUI và vẽ box `plate`. |
| 4 | Split dataset plate detector | Đã chạy no-op | Script chạy thành công, copy 0 cặp ảnh/label vì chưa có ảnh/label. |
| 5 | Dry-run train plate detector | Đã chạy | Command YOLO đã được in ra từ `config/train/plate_yolo.yaml`. |
| 6 | Train plate detector thật | Chờ dữ liệu | Cần có ảnh/label plate trong `data/plate_detection`. |
| 7 | Crop biển cho OCR | Đã chạy no-op | Script tạo manifest rỗng khi chưa có ảnh/label; không còn fail khi folder rỗng. |
| 8 | Label ký tự OCR bằng labelImg | Cần thao tác thủ công | Cần label từng ký tự trên crop biển, không label `-` hoặc `.`. |
| 9 | Split dataset char OCR | Đã chạy no-op | Copy 0 cặp crop/label vì chưa có crop/label ký tự. |
| 10 | Dry-run train char detector | Đã chạy | Command YOLO đã được in ra từ `config/train/char_yolo.yaml`. |
| 11 | Train char detector thật | Chờ dữ liệu | Cần có crop/label ký tự trong `data/char_detection`. |
| 12 | Chạy end-to-end model đã train | Chờ model | Cần `models/plate_detector_v2.pt` và `models/char_detector.pt`. |
| 13 | Audit lại `input-not-detect` | Chờ model/dữ liệu | Chạy sau khi đã train/copy model. |

## Các lệnh đã chạy

```bash
python scripts/dataset/build_ground_truth_template.py --input-dir input-not-detect --output data/ground_truth/input_not_detect.csv
python scripts/dataset/split_yolo_dataset.py --images-dir input-not-detect --output-dir data/plate_detection --ground-truth data/ground_truth/input_not_detect.csv
python scripts/train/train_yolo.py --config config/train/plate_yolo.yaml --dry-run
python scripts/dataset/crop_plates_from_yolo.py --dataset-dir data/plate_detection --split train --output-dir data/char_detection/raw_crops
python scripts/dataset/split_yolo_dataset.py --images-dir data/char_detection/raw_crops --output-dir data/char_detection
python scripts/train/train_yolo.py --config config/train/char_yolo.yaml --dry-run
```

## Việc bạn cần làm tiếp trên máy có dữ liệu

1. Copy ảnh thật vào `input-not-detect/`.
2. Chạy lại:

```bash
python scripts/dataset/build_ground_truth_template.py --input-dir input-not-detect --output data/ground_truth/input_not_detect.csv
```

3. Điền `plate_text`, `issue_type`, `plate_type`, `split`, `note` trong CSV.
4. Mở labelImg, dùng `data/labelimg_classes/plate_classes.txt`, label vùng biển.
5. Chạy split + train detector.
6. Crop biển, mở labelImg với `data/labelimg_classes/char_classes.txt`, label từng ký tự.
7. Chạy split + train char detector.
8. Chạy pipeline với:

```bash
python main.py \
  --image input-not-detect/<ten_anh>.jpg \
  --detect-engine yolo \
  --ocr-engine yolo \
  --plate-model models/plate_detector_v2.pt \
  --char-model models/char_detector.pt \
  --fallback-ocr-engine gemini
```
