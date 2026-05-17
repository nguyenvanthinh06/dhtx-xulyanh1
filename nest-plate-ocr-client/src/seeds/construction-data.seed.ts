import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource, Repository } from 'typeorm';
import { ImportPlan, ImportPlanStatus } from '../import-plans/import-plan.entity';
import { Material, MaterialCategory } from '../materials/material.entity';
import { Project, ProjectStatus } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';

type ProjectSeed = {
  code: string;
  name: string;
  location: string;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  budget: number;
};

type MaterialSeed = {
  code: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  defaultUnitPrice: number;
  active: boolean;
  description: string;
};

type SupplierSeed = {
  code: string;
  name: string;
  taxCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  note: string;
};

type ImportPlanSeed = {
  projectCode: string;
  materialCode: string;
  supplierCode?: string;
  plannedQuantity: number;
  unitPrice?: number;
  plannedDate: string;
  status: ImportPlanStatus;
  note: string;
};

const projects: ProjectSeed[] = [
  {
    code: 'CT-HCM-Q7-01',
    name: 'Chung cu An Phu Riverside',
    location: 'Phu My Hung, Quan 7, TP HCM',
    clientName: 'Cong ty CP Dia oc An Phu',
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2027-06-30',
    budget: 185_000_000_000,
  },
  {
    code: 'CT-HN-TL-02',
    name: 'Khu nha o Thang Long Green',
    location: 'Dong Anh, Ha Noi',
    clientName: 'Cong ty TNHH Thang Long Green',
    status: 'active',
    startDate: '2026-01-15',
    endDate: '2027-02-28',
    budget: 128_000_000_000,
  },
  {
    code: 'CT-DN-CB-03',
    name: 'Nha may co khi Hoa Cam',
    location: 'KCN Hoa Cam, Da Nang',
    clientName: 'Cong ty Co khi Hoa Cam',
    status: 'active',
    startDate: '2026-04-10',
    endDate: '2026-12-20',
    budget: 74_500_000_000,
  },
  {
    code: 'CT-BD-KHO-04',
    name: 'Kho logistics Song Than',
    location: 'KCN Song Than, Binh Duong',
    clientName: 'Cong ty Logistics Nam Viet',
    status: 'active',
    startDate: '2026-02-05',
    endDate: '2026-11-15',
    budget: 96_200_000_000,
  },
  {
    code: 'CT-LA-HT-05',
    name: 'Ha tang khu dan cu Tan An',
    location: 'TP Tan An, Long An',
    clientName: 'Ban quan ly du an Tan An',
    status: 'paused',
    startDate: '2025-12-01',
    endDate: '2026-10-30',
    budget: 52_800_000_000,
  },
];

const materials: MaterialSeed[] = [
  {
    code: 'CAT-XAY',
    name: 'Cat xay to',
    category: 'aggregate',
    unit: 'm3',
    defaultUnitPrice: 310_000,
    active: true,
    description: 'Cat vang dung cho xay to va can nen.',
  },
  {
    code: 'CAT-TO',
    name: 'Cat to be tong',
    category: 'aggregate',
    unit: 'm3',
    defaultUnitPrice: 345_000,
    active: true,
    description: 'Cat to da rua dung cho cap phoi be tong.',
  },
  {
    code: 'DA-1X2',
    name: 'Da 1x2 xanh',
    category: 'aggregate',
    unit: 'm3',
    defaultUnitPrice: 420_000,
    active: true,
    description: 'Da 1x2 dung cho be tong mong, cot, san.',
  },
  {
    code: 'DA-4X6',
    name: 'Da 4x6 lot mong',
    category: 'aggregate',
    unit: 'm3',
    defaultUnitPrice: 395_000,
    active: true,
    description: 'Da 4x6 dung lot nen, lot mong va duong noi bo.',
  },
  {
    code: 'THEP-D10',
    name: 'Thep cay D10 CB400',
    category: 'steel',
    unit: 'kg',
    defaultUnitPrice: 15_600,
    active: true,
    description: 'Thep gan CB400 duong kinh 10mm.',
  },
  {
    code: 'THEP-D16',
    name: 'Thep cay D16 CB400',
    category: 'steel',
    unit: 'kg',
    defaultUnitPrice: 15_900,
    active: true,
    description: 'Thep gan CB400 duong kinh 16mm.',
  },
  {
    code: 'THEP-D20',
    name: 'Thep cay D20 CB500',
    category: 'steel',
    unit: 'kg',
    defaultUnitPrice: 16_450,
    active: true,
    description: 'Thep gan CB500 duong kinh 20mm.',
  },
  {
    code: 'XI-MANG-PC40',
    name: 'Xi mang PC40',
    category: 'concrete',
    unit: 'bao',
    defaultUnitPrice: 88_000,
    active: true,
    description: 'Xi mang bao 50kg dung cho xay to va tron vua.',
  },
  {
    code: 'BE-TONG-M250',
    name: 'Be tong tuoi M250',
    category: 'concrete',
    unit: 'm3',
    defaultUnitPrice: 1_180_000,
    active: true,
    description: 'Be tong tuoi mac M250, bao gom van chuyen den cong truong.',
  },
  {
    code: 'BE-TONG-M300',
    name: 'Be tong tuoi M300',
    category: 'concrete',
    unit: 'm3',
    defaultUnitPrice: 1_255_000,
    active: true,
    description: 'Be tong tuoi mac M300 cho ket cau chiu luc.',
  },
  {
    code: 'ONG-PVC-D90',
    name: 'Ong PVC D90',
    category: 'plumbing',
    unit: 'm',
    defaultUnitPrice: 74_000,
    active: true,
    description: 'Ong thoat nuoc PVC duong kinh 90mm.',
  },
  {
    code: 'DAY-CAP-CV2.5',
    name: 'Day dien CV 2.5mm2',
    category: 'electrical',
    unit: 'cuon',
    defaultUnitPrice: 680_000,
    active: true,
    description: 'Day dien don CV 2.5mm2, cuon 100m.',
  },
  {
    code: 'ONG-LUON-D20',
    name: 'Ong luon day dien D20',
    category: 'electrical',
    unit: 'm',
    defaultUnitPrice: 9_500,
    active: true,
    description: 'Ong luon day dien PVC D20.',
  },
  {
    code: 'GACH-OP-300X600',
    name: 'Gach op lat 300x600',
    category: 'finishing',
    unit: 'm2',
    defaultUnitPrice: 235_000,
    active: true,
    description: 'Gach op lat hoan thien khu ve sinh va hanh lang.',
  },
  {
    code: 'SON-NOI-THAT',
    name: 'Son noi that cao cap',
    category: 'finishing',
    unit: 'lit',
    defaultUnitPrice: 72_000,
    active: true,
    description: 'Son nuoc noi that mau trang, tinh theo lit.',
  },
  {
    code: 'COPPHA-PHU-PHIM',
    name: 'Coppha phu phim 18mm',
    category: 'other',
    unit: 'tam',
    defaultUnitPrice: 485_000,
    active: true,
    description: 'Tam coppha phu phim dung cho san, cot, dam.',
  },
];

const suppliers: SupplierSeed[] = [
  {
    code: 'NCC-MINH-PHAT',
    name: 'VLXD Minh Phat',
    taxCode: '0312456789',
    contactPerson: 'Nguyen Van Minh',
    phone: '0903123456',
    email: 'minh.phat@example.com',
    address: 'Quoc lo 1A, Binh Chanh, TP HCM',
    active: true,
    note: 'Nha cung cap cat da khu vuc TP HCM va Long An.',
  },
  {
    code: 'NCC-SONG-DA',
    name: 'Vat lieu Song Da',
    taxCode: '0109876543',
    contactPerson: 'Tran Thi Lan',
    phone: '0918765432',
    email: 'songda.sales@example.com',
    address: 'Nam Tu Liem, Ha Noi',
    active: true,
    note: 'Manh ve cat da, xi mang cho cac cong trinh mien Bac.',
  },
  {
    code: 'NCC-HOA-SEN-STEEL',
    name: 'Thep Hoa Sen Mien Nam',
    taxCode: '3700763651',
    contactPerson: 'Pham Quoc Hung',
    phone: '0938123456',
    email: 'steel.hcm@example.com',
    address: 'KCN Song Than, Binh Duong',
    active: true,
    note: 'Cung cap thep cay theo don hang tu 5 tan tro len.',
  },
  {
    code: 'NCC-COTEC-BETON',
    name: 'Be tong Cotec ReadyMix',
    taxCode: '0311122334',
    contactPerson: 'Le Anh Tuan',
    phone: '0988112233',
    email: 'readymix@example.com',
    address: 'Cat Lai, TP Thu Duc, TP HCM',
    active: true,
    note: 'Be tong tuoi M250 den M400, co xe bom rieng.',
  },
  {
    code: 'NCC-DIEN-ANH-DUONG',
    name: 'Dien nuoc Anh Duong',
    taxCode: '0319988776',
    contactPerson: 'Vo Thanh Binh',
    phone: '0909988776',
    email: 'anhduong.me@example.com',
    address: 'Quan 12, TP HCM',
    active: true,
    note: 'Vat tu dien nuoc MEP, giao hang trong ngay.',
  },
  {
    code: 'NCC-NHUA-BINH-MINH',
    name: 'Nhua Binh Minh Dai Ly 5',
    taxCode: '0301464823',
    contactPerson: 'Do Thi Kim',
    phone: '0977445566',
    email: 'daily5.binhminh@example.com',
    address: 'Quan Tan Phu, TP HCM',
    active: true,
    note: 'Ong PVC, PPR va phu kien cap thoat nuoc.',
  },
  {
    code: 'NCC-GACH-DONG-TAM',
    name: 'Gach Dong Tam Long An',
    taxCode: '1100502668',
    contactPerson: 'Huynh Minh Quan',
    phone: '0966554433',
    email: 'dongtam.la@example.com',
    address: 'Ben Luc, Long An',
    active: true,
    note: 'Gach op lat va vat lieu hoan thien.',
  },
  {
    code: 'NCC-SIKA',
    name: 'Hoa chat xay dung Sika Viet Nam',
    taxCode: '0300818672',
    contactPerson: 'Nguyen Hoang Nam',
    phone: '0944556677',
    email: 'sika.project@example.com',
    address: 'KCN Nhon Trach, Dong Nai',
    active: true,
    note: 'Phu gia, chong tham, keo dan gach va vat tu dac thu.',
  },
];

const importPlans: ImportPlanSeed[] = [
  {
    projectCode: 'CT-HCM-Q7-01',
    materialCode: 'BE-TONG-M250',
    supplierCode: 'NCC-COTEC-BETON',
    plannedQuantity: 120,
    plannedDate: '2026-05-18',
    status: 'partial',
    note: 'Dot 1 do san tang ham B1.',
  },
  {
    projectCode: 'CT-HCM-Q7-01',
    materialCode: 'THEP-D16',
    supplierCode: 'NCC-HOA-SEN-STEEL',
    plannedQuantity: 18_000,
    plannedDate: '2026-05-20',
    status: 'planned',
    note: 'Thep cot va dam tang 1.',
  },
  {
    projectCode: 'CT-HCM-Q7-01',
    materialCode: 'CAT-XAY',
    supplierCode: 'NCC-MINH-PHAT',
    plannedQuantity: 90,
    plannedDate: '2026-05-22',
    status: 'planned',
    note: 'Bo sung kho bai khu A.',
  },
  {
    projectCode: 'CT-HCM-Q7-01',
    materialCode: 'COPPHA-PHU-PHIM',
    supplierCode: 'NCC-SIKA',
    plannedQuantity: 520,
    plannedDate: '2026-05-25',
    status: 'planned',
    note: 'Coppha cho khu thap A.',
  },
  {
    projectCode: 'CT-HN-TL-02',
    materialCode: 'DA-1X2',
    supplierCode: 'NCC-SONG-DA',
    plannedQuantity: 160,
    plannedDate: '2026-05-19',
    status: 'planned',
    note: 'Cap phoi be tong mong nha lien ke.',
  },
  {
    projectCode: 'CT-HN-TL-02',
    materialCode: 'XI-MANG-PC40',
    supplierCode: 'NCC-SONG-DA',
    plannedQuantity: 1_200,
    plannedDate: '2026-05-21',
    status: 'planned',
    note: 'Nhap kho trung tam cong truong.',
  },
  {
    projectCode: 'CT-HN-TL-02',
    materialCode: 'THEP-D10',
    supplierCode: 'NCC-HOA-SEN-STEEL',
    plannedQuantity: 9_500,
    plannedDate: '2026-05-24',
    status: 'planned',
    note: 'Thep dai cot va dam tang 2.',
  },
  {
    projectCode: 'CT-HN-TL-02',
    materialCode: 'GACH-OP-300X600',
    supplierCode: 'NCC-GACH-DONG-TAM',
    plannedQuantity: 780,
    plannedDate: '2026-06-05',
    status: 'planned',
    note: 'Vat tu hoan thien khu nha mau.',
  },
  {
    projectCode: 'CT-DN-CB-03',
    materialCode: 'BE-TONG-M300',
    supplierCode: 'NCC-COTEC-BETON',
    plannedQuantity: 95,
    plannedDate: '2026-05-17',
    status: 'planned',
    note: 'Do mong may khu xuong chinh.',
  },
  {
    projectCode: 'CT-DN-CB-03',
    materialCode: 'THEP-D20',
    supplierCode: 'NCC-HOA-SEN-STEEL',
    plannedQuantity: 14_000,
    plannedDate: '2026-05-23',
    status: 'planned',
    note: 'Thep ket cau khung xuong.',
  },
  {
    projectCode: 'CT-DN-CB-03',
    materialCode: 'ONG-LUON-D20',
    supplierCode: 'NCC-DIEN-ANH-DUONG',
    plannedQuantity: 2_400,
    plannedDate: '2026-05-28',
    status: 'planned',
    note: 'Vat tu MEP giai doan 1.',
  },
  {
    projectCode: 'CT-DN-CB-03',
    materialCode: 'SON-NOI-THAT',
    supplierCode: 'NCC-SIKA',
    plannedQuantity: 650,
    plannedDate: '2026-06-12',
    status: 'planned',
    note: 'Hoan thien nha dieu hanh.',
  },
  {
    projectCode: 'CT-BD-KHO-04',
    materialCode: 'DA-4X6',
    supplierCode: 'NCC-MINH-PHAT',
    plannedQuantity: 210,
    plannedDate: '2026-05-16',
    status: 'partial',
    note: 'Lot nen kho B va duong noi bo.',
  },
  {
    projectCode: 'CT-BD-KHO-04',
    materialCode: 'BE-TONG-M250',
    supplierCode: 'NCC-COTEC-BETON',
    plannedQuantity: 180,
    plannedDate: '2026-05-26',
    status: 'planned',
    note: 'Do san kho khu B.',
  },
  {
    projectCode: 'CT-BD-KHO-04',
    materialCode: 'DAY-CAP-CV2.5',
    supplierCode: 'NCC-DIEN-ANH-DUONG',
    plannedQuantity: 85,
    plannedDate: '2026-06-02',
    status: 'planned',
    note: 'Cap den va o cam van phong kho.',
  },
  {
    projectCode: 'CT-BD-KHO-04',
    materialCode: 'ONG-PVC-D90',
    supplierCode: 'NCC-NHUA-BINH-MINH',
    plannedQuantity: 1_150,
    plannedDate: '2026-06-04',
    status: 'planned',
    note: 'He thong thoat nuoc mai va san bai.',
  },
  {
    projectCode: 'CT-LA-HT-05',
    materialCode: 'CAT-TO',
    supplierCode: 'NCC-MINH-PHAT',
    plannedQuantity: 130,
    plannedDate: '2026-05-15',
    status: 'cancelled',
    note: 'Tam huy do cong trinh dang tam dung.',
  },
  {
    projectCode: 'CT-LA-HT-05',
    materialCode: 'DA-1X2',
    supplierCode: 'NCC-MINH-PHAT',
    plannedQuantity: 150,
    plannedDate: '2026-06-08',
    status: 'planned',
    note: 'Nhap lai khi co lenh thi cong.',
  },
  {
    projectCode: 'CT-LA-HT-05',
    materialCode: 'ONG-PVC-D90',
    supplierCode: 'NCC-NHUA-BINH-MINH',
    plannedQuantity: 900,
    plannedDate: '2026-06-10',
    status: 'planned',
    note: 'Thoat nuoc khu dan cu giai doan 2.',
  },
  {
    projectCode: 'CT-LA-HT-05',
    materialCode: 'XI-MANG-PC40',
    supplierCode: 'NCC-SONG-DA',
    plannedQuantity: 800,
    plannedDate: '2026-06-14',
    status: 'planned',
    note: 'Du phong thi cong via he.',
  },
  {
    projectCode: 'CT-HCM-Q7-01',
    materialCode: 'ONG-PVC-D90',
    supplierCode: 'NCC-NHUA-BINH-MINH',
    plannedQuantity: 720,
    plannedDate: '2026-06-01',
    status: 'planned',
    note: 'Thoat nuoc khu can ho mau.',
  },
  {
    projectCode: 'CT-HN-TL-02',
    materialCode: 'BE-TONG-M250',
    supplierCode: 'NCC-COTEC-BETON',
    plannedQuantity: 140,
    plannedDate: '2026-06-03',
    status: 'planned',
    note: 'Do san tang 1 khu B.',
  },
  {
    projectCode: 'CT-DN-CB-03',
    materialCode: 'CAT-XAY',
    supplierCode: 'NCC-MINH-PHAT',
    plannedQuantity: 65,
    plannedDate: '2026-06-07',
    status: 'planned',
    note: 'Xay tuong bao nha xuong.',
  },
  {
    projectCode: 'CT-BD-KHO-04',
    materialCode: 'THEP-D16',
    supplierCode: 'NCC-HOA-SEN-STEEL',
    plannedQuantity: 12_500,
    plannedDate: '2026-06-09',
    status: 'planned',
    note: 'Bo sung thep dam khu san nang.',
  },
];

function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function saveProjects(repository: Repository<Project>) {
  const saved: Project[] = [];
  for (const item of projects) {
    const existing = await repository.findOne({ where: { code: item.code } });
    saved.push(await repository.save(repository.create({ ...(existing ?? {}), ...item })));
  }
  return saved;
}

async function saveMaterials(repository: Repository<Material>) {
  const saved: Material[] = [];
  for (const item of materials) {
    const existing = await repository.findOne({ where: { code: item.code } });
    saved.push(await repository.save(repository.create({ ...(existing ?? {}), ...item })));
  }
  return saved;
}

async function saveSuppliers(repository: Repository<Supplier>) {
  const saved: Supplier[] = [];
  for (const item of suppliers) {
    const existing = await repository.findOne({ where: { code: item.code } });
    saved.push(await repository.save(repository.create({ ...(existing ?? {}), ...item })));
  }
  return saved;
}

async function findPlanByNaturalKey(
  repository: Repository<ImportPlan>,
  projectId: string,
  materialId: string,
  supplierId: string | undefined,
  plannedDate: string,
) {
  const query = repository
    .createQueryBuilder('plan')
    .where('plan.projectId = :projectId', { projectId })
    .andWhere('plan.materialId = :materialId', { materialId })
    .andWhere('plan.plannedDate = :plannedDate', { plannedDate });

  if (supplierId) {
    query.andWhere('plan.supplierId = :supplierId', { supplierId });
  } else {
    query.andWhere('plan.supplierId IS NULL');
  }

  return query.getOne();
}

async function saveImportPlans(
  repository: Repository<ImportPlan>,
  projectByCode: Map<string, Project>,
  materialByCode: Map<string, Material>,
  supplierByCode: Map<string, Supplier>,
) {
  const saved: ImportPlan[] = [];

  for (const item of importPlans) {
    const project = projectByCode.get(item.projectCode);
    const material = materialByCode.get(item.materialCode);
    const supplier = item.supplierCode ? supplierByCode.get(item.supplierCode) : undefined;

    if (!project) {
      throw new Error(`Missing project for code ${item.projectCode}`);
    }
    if (!material) {
      throw new Error(`Missing material for code ${item.materialCode}`);
    }
    if (item.supplierCode && !supplier) {
      throw new Error(`Missing supplier for code ${item.supplierCode}`);
    }

    const existing = await findPlanByNaturalKey(
      repository,
      project.id,
      material.id,
      supplier?.id,
      item.plannedDate,
    );

    saved.push(
      await repository.save(
        repository.create({
          ...(existing ?? {}),
          projectId: project.id,
          materialId: material.id,
          supplierId: supplier?.id,
          plannedQuantity: item.plannedQuantity,
          unitPrice: item.unitPrice ?? material.defaultUnitPrice ?? 0,
          plannedDate: item.plannedDate,
          status: item.status,
          note: item.note,
        }),
      ),
    );
  }

  return saved;
}

async function main() {
  loadLocalEnv();

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'construction_materials',
    entities: [Project, Material, Supplier, ImportPlan],
    synchronize: process.env.TYPEORM_SYNCHRONIZE !== 'false',
  });

  await dataSource.initialize();

  try {
    const savedProjects = await saveProjects(dataSource.getRepository(Project));
    const savedMaterials = await saveMaterials(dataSource.getRepository(Material));
    const savedSuppliers = await saveSuppliers(dataSource.getRepository(Supplier));

    const projectByCode = new Map(savedProjects.map((item) => [item.code, item]));
    const materialByCode = new Map(savedMaterials.map((item) => [item.code, item]));
    const supplierByCode = new Map(savedSuppliers.map((item) => [item.code, item]));

    const savedPlans = await saveImportPlans(
      dataSource.getRepository(ImportPlan),
      projectByCode,
      materialByCode,
      supplierByCode,
    );

    console.log('Construction demo data seeded successfully.');
    console.log(`Projects: ${savedProjects.length}`);
    console.log(`Materials: ${savedMaterials.length}`);
    console.log(`Suppliers: ${savedSuppliers.length}`);
    console.log(`Import plans: ${savedPlans.length}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Failed to seed construction demo data.');
  console.error(error);
  process.exitCode = 1;
});
