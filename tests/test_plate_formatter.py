import unittest

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

    def test_keeps_normal_two_letter_plate_without_dot_separator(self):
        rows = [["3", "0", "A", "B", "1", "2", "3", "4", "5"]]

        self.assertEqual(self.formatter.format(rows), "30AB-12345")


if __name__ == "__main__":
    unittest.main()
