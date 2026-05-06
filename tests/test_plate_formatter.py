import unittest

from src.character_reader import CharacterReader
from src.plate_formatter import PlateFormatter


class PlateFormatterTest(unittest.TestCase):
    def setUp(self):
        self.formatter = PlateFormatter("config/plate_rules.yaml")

    def test_formats_cd_special_plate_with_dot_separator(self):
        rows = [["8", "9", "C", "D", "0", "0", "2", "1", "3"]]

        self.assertEqual(self.formatter.format(rows), "89CD-002.13")

    def test_formats_other_special_two_letter_series_with_dot_separator(self):
        self.assertEqual(
            self.formatter.format([["8", "0", "L", "D", "1", "2", "3", "4", "5"]]),
            "80LD-123.45",
        )
        self.assertEqual(
            self.formatter.format([["8", "0", "N", "N", "1", "2", "3", "4", "5"]]),
            "80NN-123.45",
        )

    def test_formats_special_plate_when_ocr_adds_extra_leading_zero(self):
        self.assertEqual(
            self.formatter.format([["8", "9", "C", "D", "0", "0", "0", "2", "1", "3"]]),
            "89CD-002.13",
        )

    def test_keeps_normal_two_letter_plate_without_dot_separator(self):
        rows = [["3", "0", "A", "B", "1", "2", "3", "4", "5"]]

        self.assertEqual(self.formatter.format(rows), "30AB-12345")

    def test_corrects_digit_three_to_c_in_letter_position(self):
        reader = CharacterReader("config/plate_rules.yaml")

        self.assertEqual(
            reader.apply_vn_plate_corrections([["8", "9", "3", "D", "0", "0", "2", "1", "3"]]),
            [["8", "9", "C", "D", "0", "0", "2", "1", "3"]],
        )


if __name__ == "__main__":
    unittest.main()
