# Báo cáo audit ảnh input

Chưa thể tạo thống kê Roboflow đầy đủ trong môi trường hiện tại vì:

- `cv2` từ `opencv-python` lỗi thiếu thư viện hệ thống `libGL.so.1`.
- Kết nối HTTPS tới `detect.roboflow.com` bị proxy của môi trường trả `403 Forbidden`.

Dự án đã được bổ sung script `tools/audit_input_folder.py` để chạy lại audit toàn bộ folder `input` trên máy có OpenCV headless và truy cập Roboflow.

## Lệnh chạy khuyến nghị

```bash
python tools/audit_input_folder.py \
  --input-dir input \
  --detect-engine roboflow \
  --ocr-engine roboflow \
  --plate-conf 0.25 \
  --char-conf 0.25 \
  --csv docs/input_audit_results.csv \
  --report docs/input_audit_report.md
```

## Các trạng thái sẽ được thống kê

- `no_plate_detected`: không detect được vùng biển số.
- `ocr_empty`: detect được vùng biển nhưng OCR không ra text.
- `invalid_format`: OCR ra text nhưng không khớp cú pháp biển số Việt Nam cơ bản.
- `low_plate_confidence`: confidence vùng biển thấp hơn ngưỡng audit.
- `ok`: text khớp cú pháp; vẫn cần ground-truth để biết đúng tuyệt đối hay không.

## Phương án cải thiện để detect hết bộ ảnh hiện có

1. Chạy audit nhiều ngưỡng `--plate-conf`/`--char-conf` như `0.25`, `0.15`, `0.10` để tách nhóm fail do ngưỡng quá cao.
2. Với ảnh `no_plate_detected`, fine-tune detector bằng chính các ảnh fail và augmentation cho biển xa, nghiêng, mờ, thiếu sáng, bị che một phần.
3. Với ảnh `ocr_empty` hoặc `invalid_format`, tăng padding crop, upscale crop nhỏ, hạ `--char-conf`, và bổ sung dữ liệu ký tự hay nhầm như `A/4`, `B/8`, `D/0`, `G/6`, `S/5`.
4. Thêm ground-truth CSV (`image,expected_plate`) để so sánh exact-match; regex chỉ phát hiện format sai, không phát hiện được trường hợp format đúng nhưng nhầm một chữ/số.
