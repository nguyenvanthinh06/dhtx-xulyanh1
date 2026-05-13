# License Plate OCR API

## Chay API

```powershell
py api_server.py --host 0.0.0.0 --port 8000
```

Mac dinh API dung pipeline giong `run.py`:

- Detect chinh: YOLO local `models/plate_detector_v2.pt`
- OCR chinh: YOLO local `models/char_detector.pt`
- OCR fallback: Roboflow
- OCR final fallback: Gemini
- Timeout API ngoai: 60 giay

## Endpoint

### `GET /health`

Tra ve trang thai server va viec co doc duoc API key hay khong.

### `POST /detect`

Upload multipart field ten `image`.

Response thanh cong:

```json
{
  "success": true,
  "text": "20C-04080",
  "plates": [
    {
      "box": [115, 355, 199, 402],
      "score": 0.85,
      "text": "20C-04080",
      "source": "primary-detector",
      "ocr_source": "fallback-ocr"
    }
  ],
  "image_path": "uploads/...",
  "output_path": "output/api/..._result.jpg",
  "logs": []
}
```

## Test bang curl

```powershell
curl.exe -X POST http://127.0.0.1:8000/detect -F "image=@input/test24.jpg"
```

## Goi tu NestJS

Vi du service dung `axios` + `form-data`:

```ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

@Injectable()
export class PlateOcrService {
  async detectPlate(localImagePath: string) {
    const form = new FormData();
    form.append('image', fs.createReadStream(localImagePath));

    const response = await axios.post('http://127.0.0.1:8000/detect', form, {
      headers: form.getHeaders(),
      timeout: 120_000,
    });

    return response.data;
  }
}
```

Neu NestJS va API Python chay khac may/container, doi `127.0.0.1` thanh host noi bo cua server Python.
