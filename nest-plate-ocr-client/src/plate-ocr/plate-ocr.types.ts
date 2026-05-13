export interface PythonPlateOcrResponse {
  success: boolean;
  text: string;
  plates: Array<{
    box: number[];
    score: number;
    text: string;
    source?: string;
    ocr_source?: string;
    raw_text?: string;
  }>;
  image_path: string;
  output_path: string;
  logs?: string[];
}
