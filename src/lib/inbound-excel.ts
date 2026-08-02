import ExcelJS from "exceljs";

export const INBOUND_SHEET_NAME = "รับสินค้าเข้าคลัง";
export const INBOUND_TEMPLATE_FILENAME = "inbound-template.xlsx";
/** กันไฟล์ที่ใหญ่เกินจนกิน memory ของ server — งานนำเข้าปกติไม่ควรเกินหลักร้อยแถว */
export const INBOUND_MAX_ROWS = 300;
export const INBOUND_MAX_FILE_BYTES = 2 * 1024 * 1024;

type FieldKey = "merchant" | "sku" | "barcode" | "productName" | "binCode" | "qty";

const COLUMNS: {
  key: FieldKey;
  header: string;
  width: number;
  required: boolean;
  /** ชื่อหัวคอลัมน์ที่ยอมรับได้ (เทียบแบบตัดช่องว่างและไม่สนตัวพิมพ์) */
  aliases: string[];
}[] = [
  {
    key: "merchant",
    header: "ชื่อร้านค้า *",
    width: 28,
    required: true,
    aliases: ["ชื่อร้านค้า", "ร้านค้า", "merchant", "merchantname", "ลูกค้า"],
  },
  {
    // ไม่บังคับที่ระดับ "หัวคอลัมน์" เพราะบางไฟล์ระบุสินค้าด้วยบาร์โค้ดอย่างเดียว
    // แต่ระดับ "แถว" ยังบังคับว่าต้องมี SKU หรือบาร์โค้ดอย่างน้อยหนึ่งอย่าง
    key: "sku",
    header: "SKU *",
    width: 18,
    required: false,
    aliases: ["sku", "รหัสสินค้า"],
  },
  {
    key: "barcode",
    header: "บาร์โค้ด",
    width: 18,
    required: false,
    aliases: ["บาร์โค้ด", "barcode"],
  },
  {
    key: "productName",
    header: "ชื่อสินค้า (ไม่บังคับ)",
    width: 30,
    required: false,
    aliases: ["ชื่อสินค้า", "ชื่อสินค้าไม่บังคับ", "productname", "สินค้า"],
  },
  {
    key: "binCode",
    header: "รหัสตำแหน่งจัดเก็บ *",
    width: 22,
    required: true,
    aliases: ["รหัสตำแหน่งจัดเก็บ", "ตำแหน่งจัดเก็บ", "ตำแหน่ง", "bin", "bincode", "location"],
  },
  {
    key: "qty",
    header: "จำนวนที่รับเข้า *",
    width: 18,
    required: true,
    aliases: ["จำนวนที่รับเข้า", "จำนวน", "qty", "quantity"],
  },
];

export type ParsedInboundRow = {
  /** เลขแถวจริงในไฟล์ Excel เพื่อให้ผู้ใช้กลับไปแก้ได้ตรงจุด */
  rowNumber: number;
  merchant: string;
  sku: string;
  barcode: string;
  binCode: string;
  qty: string;
};

export type ParseResult =
  | { ok: true; rows: ParsedInboundRow[] }
  | { ok: false; error: string };

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[()\s ]/g, "");
}

/** ดึงข้อความจาก cell ของ exceljs ซึ่งอาจเป็น string / number / สูตร / rich text */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("formula" in value) return "";
  }
  return String(value).trim();
}

export async function parseInboundWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return { ok: false, error: "อ่านไฟล์ไม่สำเร็จ — กรุณาใช้ไฟล์ .xlsx ที่ไม่เสียหาย" };
  }

  const sheet =
    workbook.getWorksheet(INBOUND_SHEET_NAME) ?? workbook.worksheets.find((w) => w.rowCount > 0);
  if (!sheet) return { ok: false, error: "ไม่พบชีตข้อมูลในไฟล์" };

  const headerRow = sheet.getRow(1);
  const columnIndex = new Map<FieldKey, number>();
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cellText(cell.value));
    if (!normalized) return;
    const match = COLUMNS.find((c) => c.aliases.some((a) => normalizeHeader(a) === normalized));
    if (match && !columnIndex.has(match.key)) columnIndex.set(match.key, colNumber);
  });

  const missing = COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map(
    (c) => c.header
  );
  if (!columnIndex.has("sku") && !columnIndex.has("barcode")) {
    missing.push("SKU * หรือ บาร์โค้ด");
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `ไฟล์ขาดคอลัมน์ที่จำเป็นในแถวแรก: ${missing.join(", ")} — แนะนำให้ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกทับ`,
    };
  }

  const read = (row: ExcelJS.Row, key: FieldKey) => {
    const index = columnIndex.get(key);
    return index ? cellText(row.getCell(index).value) : "";
  };

  const rows: ParsedInboundRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const parsed: ParsedInboundRow = {
      rowNumber,
      merchant: read(row, "merchant"),
      sku: read(row, "sku"),
      barcode: read(row, "barcode"),
      binCode: read(row, "binCode"),
      qty: read(row, "qty"),
    };
    // ข้ามแถวว่างสนิท เพราะ Excel มักมีแถวเปล่าติดท้ายไฟล์
    if (!parsed.merchant && !parsed.sku && !parsed.barcode && !parsed.binCode && !parsed.qty) {
      continue;
    }
    if (rows.length >= INBOUND_MAX_ROWS) {
      return {
        ok: false,
        error: `ไฟล์มีข้อมูลเกิน ${INBOUND_MAX_ROWS} แถว — กรุณาแบ่งไฟล์แล้วนำเข้าทีละชุด`,
      };
    }
    rows.push(parsed);
  }

  if (rows.length === 0) return { ok: false, error: "ไม่พบข้อมูลในไฟล์ (มีแต่แถวหัวตาราง)" };
  return { ok: true, rows };
}

/**
 * สร้างไฟล์ Excel ตัวอย่าง พร้อมชีตอ้างอิงรายชื่อร้านค้าและรหัสตำแหน่งจัดเก็บจริงในระบบ
 * เพื่อให้ผู้ใช้คัดลอกชื่อไปวางได้ตรงตัว ไม่ต้องเดาว่าสะกดอย่างไร
 */
export async function buildInboundTemplate(reference: {
  merchants: { name: string; contactEmail: string }[];
  locations: { binCode: string; zone: string; aisle: string }[];
  sample: { merchant: string; sku: string; barcode: string; productName: string; binCode: string } | null;
}): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ระบบ ERP คลังสินค้า";
  workbook.created = new Date();

  // ชีตกรอกข้อมูลมี "เฉพาะหัวตาราง" โดยตั้งใจ — ถ้าใส่แถวตัวอย่างไว้ที่นี่แล้วผู้ใช้ลืมลบ
  // ระบบจะรับสินค้าเข้าสต็อกตามแถวตัวอย่างโดยที่ผู้ใช้ไม่ได้ตั้งใจ ตัวอย่างจึงย้ายไปชีต "วิธีใช้"
  const sheet = workbook.addWorksheet(INBOUND_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHeader(sheet.getRow(1));

  const example = reference.sample ?? {
    merchant: reference.merchants[0]?.name ?? "(ดูชีต รายชื่อร้านค้า)",
    sku: "SKU-001",
    barcode: "8850000000001",
    productName: "ชื่อสินค้าตัวอย่าง",
    binCode: reference.locations[0]?.binCode ?? "A-01-01",
  };

  const guide = workbook.addWorksheet("วิธีใช้");
  guide.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 26 }, { width: 22 }, { width: 18 }];
  guide.getCell("A1").value = "วิธีกรอกไฟล์นำเข้ารับสินค้าเข้าคลัง";
  guide.getCell("A1").font = { bold: true, size: 14 };
  [
    "1. กรอกข้อมูลในชีต “รับสินค้าเข้าคลัง” ตั้งแต่แถวที่ 2 ลงไป (แถวที่ 1 เป็นหัวตาราง ห้ามลบหรือแก้ชื่อ)",
    "2. คอลัมน์ที่มีเครื่องหมาย * ต้องกรอกทุกแถว",
    "3. ชื่อร้านค้าต้องตรงกับชีต “รายชื่อร้านค้า” และรหัสตำแหน่งจัดเก็บต้องตรงกับชีต “ตำแหน่งจัดเก็บ”",
    "4. ถ้าไม่ทราบ SKU ให้กรอกบาร์โค้ดแทนได้ แต่ต้องมีอย่างน้อยหนึ่งอย่าง",
    "5. จำนวนที่รับเข้าต้องเป็นจำนวนเต็มมากกว่า 0",
    `6. นำเข้าได้สูงสุด ${INBOUND_MAX_ROWS} แถวต่อไฟล์ · ถ้ามีแถวใดผิด ระบบจะไม่บันทึกทั้งไฟล์`,
  ].forEach((line, i) => {
    guide.getCell(`A${3 + i}`).value = line;
  });

  guide.getCell("A11").value = "ตัวอย่างการกรอก (ชีตนี้เป็นคำอธิบายเท่านั้น ระบบไม่อ่านข้อมูลจากที่นี่)";
  guide.getCell("A11").font = { bold: true };
  guide.getRow(12).values = COLUMNS.map((c) => c.header);
  styleHeader(guide.getRow(12));
  guide.getRow(13).values = [
    example.merchant,
    example.sku,
    example.barcode,
    example.productName,
    example.binCode,
    10,
  ];
  guide.getRow(14).values = [example.merchant, "SKU-002", "", "", example.binCode, 25];

  const merchantSheet = workbook.addWorksheet("รายชื่อร้านค้า");
  merchantSheet.columns = [
    { header: "ชื่อร้านค้า", key: "name", width: 34 },
    { header: "อีเมลติดต่อ", key: "contactEmail", width: 30 },
  ];
  styleHeader(merchantSheet.getRow(1));
  reference.merchants.forEach((m) => merchantSheet.addRow(m));

  const locationSheet = workbook.addWorksheet("ตำแหน่งจัดเก็บ");
  locationSheet.columns = [
    { header: "รหัสตำแหน่งจัดเก็บ", key: "binCode", width: 24 },
    { header: "โซน", key: "zone", width: 12 },
    { header: "แถว", key: "aisle", width: 12 },
  ];
  styleHeader(locationSheet.getRow(1));
  reference.locations.forEach((l) => locationSheet.addRow(l));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F9" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB9C4D4" } } };
  });
  row.height = 22;
}
