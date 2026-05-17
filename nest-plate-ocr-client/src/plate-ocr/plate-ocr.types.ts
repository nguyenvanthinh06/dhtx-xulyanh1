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
  source_hint_path?: string | null;
  output_image_base64?: string;
  options?: Record<string, unknown>;
  logs?: string[];
}

export interface PlateOcrDetectOptions {
  detectEngine?: string;
  ocrEngine?: string;
  fallback?: string;
  finalFallback?: string;
  fallbackDetect?: string;
  plateModel?: string;
  fallbackPlateModel?: string;
  charModel?: string;
  plateConf?: string;
  fallbackPlateConf?: string;
  charConf?: string;
  plateCropScale?: string;
  minPlateWidth?: string;
  includeLogs?: string | boolean;
  includeImage?: string | boolean;
}

export const PLATE_OCR_OPTION_KEYS: Array<keyof PlateOcrDetectOptions> = [
  'detectEngine',
  'ocrEngine',
  'fallback',
  'finalFallback',
  'fallbackDetect',
  'plateModel',
  'fallbackPlateModel',
  'charModel',
  'plateConf',
  'fallbackPlateConf',
  'charConf',
  'plateCropScale',
  'minPlateWidth',
  'includeLogs',
  'includeImage',
];
