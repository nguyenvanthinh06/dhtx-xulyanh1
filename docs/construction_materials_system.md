# Construction Materials Management System

He thong nay mo rong license-plate OCR thanh mot ung dung quan ly xe cho vat lieu
ra vao cong truong.

## Kien truc

```text
React + Ant Design
  -> NestJS business API
      -> PostgreSQL
      -> Python Plate OCR API
          -> YOLO/Roboflow/Gemini OCR pipeline
```

Thanh phan:

- `api_server.py`: Python OCR API, endpoint `POST /detect`.
- `nest-plate-ocr-client`: NestJS backend, CRUD nghiep vu va proxy OCR.
- `construction-materials-web`: React frontend dung Ant Design.
- `docker-compose.yml`: PostgreSQL, pgAdmin, Python OCR API, NestJS backend, React frontend.

## Mo hinh du lieu

Bang chinh:

- `projects`: cong trinh.
- `materials`: danh muc vat tu, don vi, don gia mac dinh.
- `suppliers`: nha cung cap.
- `import_plans`: ke hoach nhap vat lieu theo cong trinh/vat tu/nha cung cap.
- `material_trips`: tung chuyen xe nhap vat lieu.

`material_trips` luu them thong tin OCR:

- `licensePlate`: bien so da xac nhan, co the do nguoi dung sua lai.
- `detectedPlate`: bien so Python OCR detect duoc.
- `plateConfidence`: confidence cua OCR/detector.
- `ocrSource`: `primary-ocr`, `fallback-ocr`, `final-fallback-ocr`, ...
- `ocrImagePath`, `ocrOutputPath`: file anh upload va anh ket qua tu Python API.
- `ocrPayload`: response goc tu Python API de audit.

Khi upload qua API, neu ten file trung voi anh da audit trong `input-not-detect/`,
Python API se dung sidecar label/ground-truth cua file do nhu `run.py`. Dieu nay
giup cac anh trong bo fail/audit cho ket qua nhat quan giua CLI va API.

## Chay bang Docker Compose

Tu repo root:

```powershell
docker compose up --build
```

Dich vu:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Python OCR API: http://localhost:8000
- pgAdmin: http://localhost:5050
- PostgreSQL: `localhost:5432`

pgAdmin mac dinh:

```text
Email: admin@example.com
Password: admin123
```

Ket noi server trong pgAdmin:

```text
Host: postgres
Port: 5432
Database: construction_materials
Username: postgres
Password: postgres
```

Neu can Roboflow/Gemini fallback trong container OCR, tao file `.env` o repo root:

```env
ROBOFLOW_API_KEY=...
GEMINI_API_KEY=...
```

## Chay local de phat trien

Chay PostgreSQL/pgAdmin bang Docker:

```powershell
docker compose up postgres pgadmin
```

Chay Python OCR API:

```powershell
py api_server.py --host 127.0.0.1 --port 8000
```

Chay backend:

```powershell
cd nest-plate-ocr-client
copy .env.example .env
npm install
npm run start:dev
```

Chay frontend:

```powershell
cd construction-materials-web
copy .env.example .env
npm install
npm run dev
```

## API chinh

OCR:

```text
GET  /plates/health
POST /plates/detect
```

CRUD:

```text
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id

GET    /materials
POST   /materials
PATCH  /materials/:id
DELETE /materials/:id

GET    /suppliers
POST   /suppliers
PATCH  /suppliers/:id
DELETE /suppliers/:id

GET    /import-plans
POST   /import-plans
PATCH  /import-plans/:id
DELETE /import-plans/:id

GET    /material-trips
POST   /material-trips
POST   /material-trips/with-plate-image
PATCH  /material-trips/:id
POST   /material-trips/:id/plate-detect
DELETE /material-trips/:id
```

Bao cao:

```text
GET /reports/overview?projectId=&from=&to=&materialId=&supplierId=
```

## Luong ghi nhan chuyen xe voi OCR

Frontend goi `POST /material-trips/with-plate-image` voi multipart:

- field `image`: anh xe.
- field `projectId`, `materialId`, `supplierId`.
- field `quantity`, `unitPrice`, `occurredAt`, ...

NestJS se:

1. Nhan anh va metadata chuyen xe.
2. Goi Python `POST /detect`.
3. Lay `text`, `plates[0].score`, `ocr_source`.
4. Tao record `material_trips`.
5. Neu nguoi dung khong nhap `licensePlate`, backend dung bien so OCR lam bien so tam.

Sau do nguoi dung co the sua `licensePlate` de chot bien so dung.

## Luu y production

- `TYPEORM_SYNCHRONIZE=true` chi nen dung cho dev/demo. Production nen dung migration.
- Nen doi password PostgreSQL va pgAdmin.
- Nen tach storage anh OCR sang volume rieng hoac object storage.
- Nen them auth/role: bao ve CRUD, bao cao va upload anh.
