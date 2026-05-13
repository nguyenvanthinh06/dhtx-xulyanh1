# === Module: character_reader.py ===
# Class cha (base class) dung chung cho tat ca OCR engine (Roboflow, YOLO, ...).
# Cung cap logic:
# 1. Nhan anh crop bien so
# 2. Goi engine con de detect ky tu
# 3. Gom ky tu thanh cac dong (1 dong hoac 2 dong)
# 4. Format thanh text bien so

# Import PlateFormatter de format text bien so theo rule YAML
# Vi du: "30A12345" -> "30A-12345"
import re

from src.plate_formatter import PlateFormatter


class CharacterReader:
    """
    Class cha cho cac OCR engine.
    
    Cac class con (RoboflowCharacterOCR, YoloCharacterOCR) chi can
    override ham detect_chars() de tra ve danh sach ky tu.
    Logic sort va format da duoc xu ly o day.
    """

    def __init__(self, config_path: str = "config/plate_rules.yaml", debug: bool = False):
        # Tao PlateFormatter tu file config YAML.
        # PlateFormatter chua cac regex rule de format text bien so VN.
        self.formatter = PlateFormatter(config_path)
        self.debug = debug

        # Bang chuyen doi ky tu hay bi nham lan giua chu va so.
        # Roboflow hoac YOLO co the nhan nham "0" thanh "O" hoac nguoc lai.
        # Bang nay giup sua lai trong truong hop can.
        self.char_corrections = {
            # Cac ky tu so hay bi nham thanh chu
            "O": "0",    # Chu O -> So 0 (khi o vi tri so)
            "I": "1",    # Chu I -> So 1 (khi o vi tri so)
            "Z": "2",    # Chu Z -> So 2 (it gap nhung co the xay ra)
            "S": "5",    # Chu S -> So 5 (khi o vi tri so)
            "B": "8",    # Chu B -> So 8 (khi o vi tri so)
            "G": "6",    # Chu G -> So 6 (it gap)
            # Cac ky tu chu hay bi nham thanh so
            "0": "O",    # So 0 -> Chu O (khi o vi tri chu, vi du phan seri)
            "1": "I",    # So 1 -> Chu I (it dung, nhung co the)
            "8": "B",    # So 8 -> Chu B (it dung)
        }

    def recognize(self, plate_image):
        """
        Ham chinh: nhan anh crop bien so va tra ve text bien so.

        Flow:
        1. detect_chars(): goi engine con (Roboflow/YOLO) detect tung ky tu
        2. group_chars_to_rows(): gom ky tu thanh 1 hoac 2 dong dua tren vi tri y
        3. apply_vn_plate_corrections(): sua ky tu nham dua tren quy tac bien VN
        4. formatter.format(): ap dung regex rule de format (vi du: "30A-12345")
        
        Input:
            plate_image: numpy array (BGR) - anh crop bien so

        Output:
            str - text bien so da format (vi du: "30A-12345", "72A-05747")
        """
        # Buoc 1: Goi engine con de detect ky tu
        chars = self.detect_chars(plate_image)

        if self.debug:
            self._debug_print_chars(chars)

        # Neu khong detect duoc ky tu nao thi tra chuoi rong
        if not chars:
            return ""

        # Buoc 2: Gom ky tu thanh cac dong
        rows = self.group_chars_to_rows(chars)

        # In ra ket qua gom dong de debug
        print(f"  [CharReader] Rows (raw): {rows}")

        # Buoc 3: Sua ky tu nham dua tren quy tac bien so VN
        rows = self.apply_vn_plate_corrections(rows)

        # In ra ket qua sau khi sua
        print(f"  [CharReader] Rows (fixed): {rows}")

        # Buoc 4: Format text bien so theo rule YAML
        text = self.formatter.format(rows)

        recovered_text = self._recover_by_dropping_noisy_char(chars, text)
        if recovered_text:
            return recovered_text

        return text

    def _is_valid_plate_text(self, text):
        """Kiem tra nhanh text da format co giong bien so Viet Nam khong."""
        normalized = re.sub(r"[^0-9A-Z]", "", text.upper())

        match = re.match(r"^([0-9]{2})([A-Z]{1,2})([0-9]{4,6})$", normalized)
        if not match:
            return False

        _, letters, digits = match.groups()
        valid_letters = set("ABCDEFGHKLMNPSTUVXY")
        special_pairs = {"CD", "LD", "NN", "NG", "QT", "CV"}

        if len(letters) == 1:
            return letters in valid_letters and 4 <= len(digits) <= 5

        if len(letters) == 2:
            if letters in special_pairs:
                return len(digits) == 5
            return all(ch in valid_letters for ch in letters) and 4 <= len(digits) <= 5

        return False

    def _recover_by_dropping_noisy_char(self, chars, current_text):
        """
        Roboflow/YOLO doi khi detect thua 1 ky tu nhiu co confidence thap.
        Neu text hien tai sai format, thu bo tung ky tu thap diem va format lai.
        """
        if self._is_valid_plate_text(current_text) or len(chars) < 8:
            return None

        candidates = sorted(
            enumerate(chars),
            key=lambda item: item[1].get("score", 1.0),
        )

        for index, ch in candidates:
            if ch.get("score", 1.0) > 0.35:
                continue

            remaining_chars = [
                item
                for candidate_index, item in enumerate(chars)
                if candidate_index != index
            ]
            candidate_rows = self.group_chars_to_rows(remaining_chars)
            candidate_rows = self.apply_vn_plate_corrections(candidate_rows)
            candidate_text = self.formatter.format(candidate_rows)

            if self._is_valid_plate_text(candidate_text):
                print(
                    "  [CharReader] Recovered valid plate by dropping noisy "
                    f"char '{ch.get('char')}' score={ch.get('score', 0.0):.2f}: "
                    f"'{current_text}' -> '{candidate_text}'"
                )
                return candidate_text

        return None

    def _debug_print_chars(self, chars):
        """In chi tiet cac ky tu detect duoc de debug model OCR YOLO/Roboflow."""
        print(f"  [CharReader][debug] Detected chars: {len(chars)}")
        if not chars:
            return

        # In theo thu tu trai -> phai de nhin nhanh chuoi OCR raw truoc khi group row.
        for index, ch in enumerate(sorted(chars, key=lambda item: (item["cy"], item["cx"])), 1):
            box = ch.get("box", [])
            score = ch.get("score", 0.0)
            print(
                "  [CharReader][debug] "
                f"#{index}: char={ch.get('char')!r} score={score:.3f} "
                f"cx={ch.get('cx'):.1f} cy={ch.get('cy'):.1f} box={box}"
            )

    def detect_chars(self, plate_image):
        """
        Ham nay PHAI duoc override boi class con.
        
        Class con (RoboflowCharacterOCR, YoloCharacterOCR) se cai dat
        logic detect ky tu rieng cua minh.
        
        Raise NotImplementedError neu class con chua override.
        """
        raise NotImplementedError("Character OCR must implement detect_chars().")

    def group_chars_to_rows(self, chars):
        """
        Gom cac ky tu thanh cac dong (row) dua tren vi tri y cua chung.

        Logic dynamic - khong hard-code bien 1 dong hay 2 dong:
        - Tinh chieu cao trung binh cua tat ca ky tu
        - Dung nguong (threshold) = chieu_cao_tb * row_threshold_ratio
        - 2 ky tu cach nhau > threshold thi o khac dong
        - 2 ky tu cach nhau <= threshold thi cung dong

        Vi du bien 2 dong:
            Dong 1: "30A"  (y ~ 30)
            Dong 2: "12345" (y ~ 70)
            threshold = 26 (chieu cao tb 40 * 0.65)
            |70 - 30| = 40 > 26 -> khac dong

        Input:
            chars: list[dict] - danh sach ky tu tu detect_chars()

        Output:
            list[list[str]] - cac dong ky tu da sort
            Vi du: [["3", "0", "A"], ["1", "2", "3", "4", "5"]]
        """

        # Truong hop co 0 hoac 1 ky tu: khong can chia dong
        if len(chars) <= 1:
            return [[c["char"] for c in chars]]

        # Sap xep ky tu theo toa do y (tu tren xuong duoi) truoc khi gom dong.
        # Dieu nay giup cac ky tu cung dong duoc xet lien ke nhau.
        chars = sorted(chars, key=lambda c: c["cy"])

        # Tinh chieu cao trung binh cua tat ca ky tu.
        # Gia tri nay dung de tinh threshold phan biet dong.
        avg_height = sum(c["height"] for c in chars) / len(chars)

        # Doc ti le threshold tu file config YAML.
        # Mac dinh 0.65, co nghia: 2 ky tu cach nhau > 65% chieu cao tb
        # se duoc xem la khac dong.
        row_threshold_ratio = self.formatter.layout_config.get(
            "row_threshold_ratio",   # Ten key trong YAML
            0.65                     # Gia tri mac dinh neu YAML khong co
        )

        # Tinh threshold tuyet doi (pixel).
        # Vi du: avg_height=40, ratio=0.65 -> threshold=26 pixel
        threshold = avg_height * row_threshold_ratio

        # Tao danh sach cac dong (moi dong la list cac char dict)
        rows = []

        # Duyet tung ky tu (da sort theo y) de gom vao dong
        for ch in chars:
            added = False

            # Thu gom ky tu vao 1 dong co san
            for row in rows:
                # Tinh tam y trung binh cua dong dang xet
                row_cy = sum(item["cy"] for item in row) / len(row)

                # Neu khoang cach y cua ky tu hien tai va dong dang xet
                # nho hon hoac bang threshold -> cung dong
                if abs(ch["cy"] - row_cy) <= threshold:
                    row.append(ch)  # Them ky tu vao dong nay
                    added = True
                    break  # Da gom vao dong, khong can xet dong khac

            # Neu khong khop voi dong nao da co -> tao dong moi
            if not added:
                rows.append([ch])

        # Sap xep cac dong tu tren xuong duoi (theo tam y trung binh)
        rows = sorted(
            rows,
            key=lambda row: sum(item["cy"] for item in row) / len(row)
        )

        # Trong moi dong, sap xep ky tu tu trai sang phai (theo tam x)
        # va chi lay text ky tu (bo metadata box, score, ...)
        sorted_rows = []
        for row in rows:
            # Sort theo cx (toa do tam ngang) -> thu tu trai-phai
            row = sorted(row, key=lambda c: c["cx"])

            # Chi lay gia tri "char" cua moi dict
            sorted_rows.append([c["char"] for c in row])

        return sorted_rows

    def apply_vn_plate_corrections(self, rows):
        """
        Sua ky tu bi nham dua tren quy tac bien so xe Viet Nam.

        Quy tac bien so VN:
        - Bien 1 dong: [2 so] [1-2 chu cai] [4-5 so]
          Vi du: 51A-17556, 30AB-12345
        - Bien 2 dong: dong tren [2 so][1-2 chu cai], dong duoi [4-5 so]
          Vi du: dong tren "30A", dong duoi "12345"

        Logic sua:
        - Vi tri 3 (index 2) cua bien 1 dong PHAI la chu cai
          -> Neu la so, doi sang chu cai tuong ung
        - Vi tri 4 (index 3) co the la chu cai thu 2 (bien 2 chu: 30AB)
          hoac so dau tien (bien 1 chu: 30A1)
        - Tat ca vi tri con lai PHAI la so
          -> Neu la chu, doi sang so tuong ung

        Bang doi:
            So -> Chu: 4->A, 8->B, 0->D, 6->G, 1->T (thuong gap nhat)
            Chu -> So: A->4, B->8, D->0, O->0, I->1, S->5, Z->2, G->6

        Args:
            rows: list[list[str]] - cac dong ky tu da sort

        Returns:
            list[list[str]] - cac dong ky tu da sua
        """

        # Gom tat ca ky tu thanh 1 list phang de xu ly
        flat = []
        for row in rows:
            flat.extend(row)

        total = len(flat)

        # Chi xu ly neu co du ky tu (toi thieu 7: 2so + 1chu + 4so)
        if total < 7:
            return rows

        # === Bang doi ky tu ===
        # Khi vi tri CAN la CHU nhung OCR nhan la SO:
        digit_to_alpha = {
            "4": "A",   # Roboflow hay nham A thanh 4 (thuong gap nhat!)
            "8": "B",   # 8 giong B
            "0": "D",   # 0 giong D hoac O
            "6": "G",   # 6 giong G
            "1": "T",   # 1 giong T (it gap)
            "2": "Z",   # 2 giong Z (it gap)
            "3": "C",   # 3 giong C (gap voi bien CD/NG/NN dac biet)
            "5": "S",   # 5 giong S (it gap)
        }

        # Khi vi tri CAN la SO nhung OCR nhan la CHU:
        alpha_to_digit = {
            "A": "4",   # A giong 4
            "B": "8",   # B giong 8
            "D": "0",   # D giong 0
            "O": "0",   # O giong 0
            "I": "1",   # I giong 1
            "S": "5",   # S giong 5
            "Z": "2",   # Z giong 2
            "G": "6",   # G giong 6
            "T": "1",   # T giong 1
            "K": "K",   # K la ky tu hop le, giu nguyen
            "M": "M",   # M giu nguyen (nhung M khong phai ky tu bien VN)
        }

        # Danh sach chu cai hop le tren bien so VN
        # Bien so VN dung A-Z nhung pho bien nhat la: A, B, C, D, E, F, G, H, K, L, M, N, P, S, T, U, V, X, Y
        valid_plate_letters = set("ABCDEFGHKLMNPSTUVXY")

        # === Buoc 1: Sua vi tri 3 (index 2) - PHAI la chu cai ===
        # Bien so VN luon co dang: [SO][SO][CHU]...
        # Neu vi tri 3 la so -> doi thanh chu
        if flat[2].isdigit():
            old = flat[2]
            flat[2] = digit_to_alpha.get(flat[2], flat[2])
            if old != flat[2]:
                print(f"  [VN-Fix] Position 3: '{old}' -> '{flat[2]}' (phai la chu cai)")

        # === Buoc 2: Kiem tra vi tri 4 (index 3) ===
        # Neu la chu cai hop le -> bien 2 chu (vi du: 30AB-12345)
        # Neu la so -> bien 1 chu (vi du: 30A-12345)
        has_second_letter = False
        if total >= 9 and flat[3].isalpha() and flat[3] in valid_plate_letters:
            has_second_letter = True
        elif flat[3].isdigit() and flat[3] in digit_to_alpha:
            # Thu xem neu doi sang chu thi co tao bien hop le khong
            # Bien 9-10 ky tu thuong co 2 chu
            if total >= 9:
                old = flat[3]
                flat[3] = digit_to_alpha.get(flat[3], flat[3])
                if flat[3] in valid_plate_letters:
                    has_second_letter = True
                    print(f"  [VN-Fix] Position 4: '{old}' -> '{flat[3]}' (chu cai thu 2)")
                else:
                    flat[3] = old  # Khong hop le, tra lai

        # === Buoc 3: Sua cac vi tri so ===
        # Vi tri 1-2 (index 0,1) PHAI la so
        for i in range(2):
            if flat[i].isalpha():
                old = flat[i]
                flat[i] = alpha_to_digit.get(flat[i], flat[i])
                if old != flat[i]:
                    print(f"  [VN-Fix] Position {i+1}: '{old}' -> '{flat[i]}' (phai la so)")

        # Cac vi tri sau phan chu cai PHAI la so
        start_digit = 3 if not has_second_letter else 4
        for i in range(start_digit, total):
            if flat[i].isalpha():
                old = flat[i]
                flat[i] = alpha_to_digit.get(flat[i], flat[i])
                # Neu khong doi duoc (khong co trong bang) -> giu nguyen
                if flat[i].isalpha() and flat[i] not in valid_plate_letters:
                    flat[i] = "0"  # Fallback thanh 0
                if old != flat[i]:
                    print(f"  [VN-Fix] Position {i+1}: '{old}' -> '{flat[i]}' (phai la so)")

        # === Buoc 4: Tai tao rows tu flat da sua ===
        idx = 0
        new_rows = []
        for row in rows:
            new_row = flat[idx:idx + len(row)]
            new_rows.append(new_row)
            idx += len(row)

        return new_rows

