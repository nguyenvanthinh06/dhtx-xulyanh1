# === Module: plate_formatter.py ===
# Format text bien so theo cac rule dinh nghia trong file YAML.
# Ap dung regex pattern de chuyen text tho (vi du: "30A12345")
# thanh dang chuan (vi du: "30A-12345").

# re: thu vien regex cua Python, dung de match va extract pattern
import re

# yaml: doc file cau hinh YAML (plate_rules.yaml)
import yaml


class PlateFormatter:
    """
    Format text bien so xe Viet Nam theo cac rule YAML.
    
    Cac loai rule:
    1. regex: match toan bo text voi 1 pattern, format lai
    2. two_rows: match rieng dong tren va dong duoi
    3. fallback: tra ve text goc neu khong match rule nao

    Vi du rules:
        - pattern "^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$"
          match "30A12345" -> output "30A-12345"
        - two_rows: top "30A" + bottom "12345" -> "30A-12345"
    """

    def __init__(self, config_path: str = "config/plate_rules.yaml"):
        """
        Doc file config YAML va nap cac rule format.

        Args:
            config_path: duong dan den file YAML chua rule
                         Vi du: "config/plate_rules.yaml"
        """
        # Mo va doc file YAML
        # encoding="utf-8" de ho tro ky tu unicode
        with open(config_path, "r", encoding="utf-8") as f:
            # yaml.safe_load: parse YAML thanh dict Python
            # safe_load an toan hon load() vi khong thuc thi code
            self.config = yaml.safe_load(f)

        # Lay cau hinh layout (row_threshold_ratio, min_chars_for_two_rows)
        # Dung cho CharacterReader khi gom ky tu thanh dong
        self.layout_config = self.config.get("layout", {})

        # Lay cau hinh format (remove_unknown_chars, output_separator_between_rows)
        self.format_config = self.config.get("format", {})

        # Lay danh sach rules (regex, two_rows, fallback)
        self.rules = self.config.get("rules", [])

    def format(self, rows):
        """
        Format danh sach dong ky tu thanh text bien so.

        Args:
            rows: list[list[str]] - cac dong ky tu da sort
                  Vi du: [["3", "0", "A"], ["1", "2", "3", "4", "5"]]

        Returns:
            str - text bien so da format
                  Vi du: "30A-12345"
        """
        # Gom tung dong thanh chuoi: [["3","0","A"], ["1","2","3","4","5"]]
        # -> ["30A", "12345"]
        text_rows = ["".join(row) for row in rows]

        # Gom tat ca dong thanh 1 chuoi lien tiep: "30A12345"
        raw = "".join(text_rows)

        # Chuan hoa: upper case va loai bo ky tu la
        raw = self._normalize_text(raw)
        text_rows = [self._normalize_text(row) for row in text_rows]

        # Thu ap dung tung rule theo thu tu uu tien
        for rule in self.rules:
            # Lay loai rule: "regex", "two_rows", hoac "fallback"
            rule_type = rule.get("type")

            # --- Rule regex: match toan bo text voi pattern ---
            if rule_type == "regex":
                result = self._apply_regex_rule(raw, rule)
                # Neu match -> tra ve ket qua da format
                if result:
                    return result

            # --- Rule two_rows: match rieng dong tren va dong duoi ---
            if rule_type == "two_rows" and len(text_rows) == 2:
                result = self._apply_two_rows_rule(text_rows, rule)
                if result:
                    return result

            # --- Rule fallback: tra ve text goc neu khong match rule nao ---
            if rule_type == "fallback":
                # Thay {raw} trong template bang text goc
                return rule.get("output", "{raw}").replace("{raw}", raw)

        # Neu khong co rule fallback, tra ve text goc
        return raw

    def _normalize_text(self, text):
        """
        Chuan hoa text: chuyen len UPPER CASE va loai bo ky tu khong phai A-Z, 0-9.

        Args:
            text: str - text can chuan hoa

        Returns:
            str - text da chuan hoa
                  Vi du: "30a-123" -> "30A123"
        """
        # Chuyen tat ca thanh chu hoa
        text = text.upper()

        # Neu config bat "remove_unknown_chars" (mac dinh True):
        # loai bo tat ca ky tu khong phai [A-Z0-9]
        # Vi du: "30A-12345" -> "30A12345" (bo dau gach ngang)
        if self.format_config.get("remove_unknown_chars", True):
            # re.sub thay the tat ca ky tu KHONG phai A-Z hoac 0-9 bang ""
            text = re.sub(r"[^0-9A-Z]", "", text)

        return text

    def _apply_regex_rule(self, raw, rule):
        """
        Thu ap dung 1 regex rule len text.

        Args:
            raw: str - text da normalize (vi du: "30A12345")
            rule: dict - rule tu YAML, co "pattern" va "output"

        Returns:
            str hoac None - text da format neu match, None neu khong match

        Vi du:
            pattern: "^([0-9]{2})([A-Z]{1,2})([0-9]{4,5})$"
            raw: "30A12345"
            groups: ("30", "A", "12345")
            output template: "{1}{2}-{3}"
            result: "30A-12345"
        """
        # Lay pattern regex va output template tu rule
        pattern = rule.get("pattern")
        output = rule.get("output")

        # Neu thieu pattern hoac output thi bo qua rule nay
        if not pattern or not output:
            return None

        # Thu match pattern voi text
        match = re.match(pattern, raw)

        # Neu khong match -> tra ve None, thu rule tiep theo
        if not match:
            return None

        # Thay the {1}, {2}, {3}, ... trong template bang cac group da match
        result = output
        for i, group in enumerate(match.groups(), start=1):
            # Vi du: {1} -> "30", {2} -> "A", {3} -> "12345"
            result = result.replace("{" + str(i) + "}", group)

        return result

    def _apply_two_rows_rule(self, text_rows, rule):
        """
        Thu ap dung rule 2 dong len text.

        Args:
            text_rows: list[str] co 2 phan tu - dong tren va dong duoi
                       Vi du: ["30A", "12345"]
            rule: dict - rule tu YAML, co "top_pattern", "bottom_pattern", "output"

        Returns:
            str hoac None - text da format neu match, None neu khong match

        Vi du:
            top: "30A", top_pattern: "^([0-9]{2})([A-Z]{1,2})$" -> match
            bottom: "12345", bottom_pattern: "^([0-9]{4,5})$" -> match
            output: "{top}-{bottom}" -> "30A-12345"
        """
        # Tach dong tren va dong duoi
        top = text_rows[0]      # Dong tren: vi du "30A"
        bottom = text_rows[1]   # Dong duoi: vi du "12345"

        # Lay cac pattern va template tu rule
        top_pattern = rule.get("top_pattern")
        bottom_pattern = rule.get("bottom_pattern")
        output = rule.get("output")

        # Kiem tra rule co day du thong tin khong
        if not top_pattern or not bottom_pattern or not output:
            return None

        # Thu match dong tren voi top_pattern
        if not re.match(top_pattern, top):
            return None

        # Thu match dong duoi voi bottom_pattern
        if not re.match(bottom_pattern, bottom):
            return None

        # Thay the {top} va {bottom} trong template bang text thuc te
        return output.replace("{top}", top).replace("{bottom}", bottom)