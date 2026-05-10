import os
import subprocess
import shutil
import sys

# Đường dẫn đến các công cụ
PYTHON_EXE = r"C:\Users\ADMIN\AppData\Local\Programs\Python\Python311\python.exe"
# Chuyển sang gọi module trực tiếp để thấy log lỗi nếu có
LABELIMG_CMD = [PYTHON_EXE, "-m", "labelImg.labelImg"]

def open_tool(mode="plate"):
    if mode == "char":
        input_dir = os.path.abspath("data/char_detection/raw_crops")
        classes_source = os.path.abspath("data/labelimg_classes/char_classes.txt")
    else:
        input_dir = os.path.abspath("input-not-detect")
        classes_source = os.path.abspath("data/labelimg_classes/plate_classes.txt")

    if not os.path.exists(input_dir):
        print(f"Lỗi: Không tìm thấy thư mục {input_dir}")
        return

    # Sửa lỗi file classes.txt (đảm bảo xuống dòng chuẩn Windows)
    target_classes = os.path.join(input_dir, "classes.txt")
    try:
        with open(classes_source, 'r', encoding='utf-8') as f:
            lines = f.read().splitlines()
        with open(target_classes, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(lines) + '\n')
        print(f"Đã chuẩn hóa file cấu hình: {target_classes}")
    except Exception as e:
        print(f"Cảnh báo: {e}")

    # Xóa file settings cũ
    user_home = os.path.expanduser("~")
    settings_file = os.path.join(user_home, ".labelImgSettings.pkl")
    if os.path.exists(settings_file):
        try: os.remove(settings_file)
        except: pass

    print(f"--- Đang mở labelImg [{mode.upper()}] ---")
    print("LƯU Ý: VUI LÒNG TẮT UNIKEY/EVKEY TRƯỚC KHI VẼ.")
    
    cmd = LABELIMG_CMD + [input_dir, target_classes]
    
    try:
        # Chạy và giữ terminal để xem log nếu crash
        subprocess.run(cmd)
    except Exception as e:
        print(f"Lỗi: {e}")

if __name__ == "__main__":
    mode = "plate"
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    open_tool(mode)
