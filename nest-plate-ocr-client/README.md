# NestJS Plate OCR + Construction Materials API

NestJS backend de:

- Nhan anh upload va forward sang Python OCR API trong repo cha.
- Quan ly cong trinh, vat tu, nha cung cap, ke hoach nhap vat lieu.
- Ghi nhan tung chuyen xe nhap vat lieu, ket hop OCR bien so.
- Tra bao cao tong hop theo cong trinh/vat tu/nha cung cap/thoi gian.

## Payload

Endpoint Python `POST /detect` va endpoint NestJS `POST /plates/detect` deu dung:

```text
Content-Type: multipart/form-data
field name: image
value: binary image file
```

Vi du multipart:

```bash
curl -X POST http://localhost:3000/plates/detect \
  -F "image=@../input/test24.jpg"
```

## Chay Python OCR API

Tu repo cha:

```powershell
py api_server.py --host 127.0.0.1 --port 8000
```

Neu NestJS chay trong container hoac may khac, dung:

```powershell
py api_server.py --host 0.0.0.0 --port 8000
```

## Chay NestJS

```powershell
cd nest-plate-ocr-client
copy .env.example .env
npm install
npm run start:dev
```

Mac dinh `.env`:

```env
PORT=3000
PLATE_OCR_API_URL=http://127.0.0.1:8000
PLATE_OCR_TIMEOUT_MS=120000
MAX_UPLOAD_MB=15
```

## Endpoints

```text
GET  /plates/health
POST /plates/detect
GET  /projects
GET  /materials
GET  /suppliers
GET  /import-plans
GET  /material-trips
POST /material-trips/with-plate-image
GET  /reports/overview
```

Response mau:

```json
{
  "success": true,
  "text": "29HC-00542",
  "plates": [
    {
      "box": [143, 286, 197, 319],
      "score": 0.5137523412704468,
      "text": "29HC-00542",
      "source": "primary-detector",
      "ocr_source": "fallback-ocr"
    }
  ],
  "image_path": "uploads/...",
  "output_path": "output/api/...",
  "logs": []
}
```

## Neu BE cua ban da co file path local

Co the goi truc tiep Python API bang `form-data`:

```ts
import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

export async function detectPlate(localImagePath: string) {
  const form = new FormData();
  form.append('image', fs.createReadStream(localImagePath));

  const response = await axios.post('http://127.0.0.1:8000/detect', form, {
    headers: form.getHeaders(),
    timeout: 120_000,
  });

  return response.data;
}
```
