/**
 * ตัวเชื่อมต่อ Track & Trace API ของไปรษณีย์ไทย
 * เอกสาร: https://track.thailandpost.co.th/developerGuide
 *
 * การยืนยันตัวตนมี 2 ชั้น
 *   1) API key ถาวรที่ได้จากการสมัครใช้งานบนเว็บไปรษณีย์ไทย เก็บใน env `THAILANDPOST_API_KEY`
 *   2) เอา API key ไปแลก access token ที่ /authenticate/token แล้วใช้ token นั้นเรียก /track
 * token มีอายุยาว (ตามเอกสารประมาณ 1 เดือน) จึงต้อง cache ไว้ ไม่ขอใหม่ทุกครั้ง
 */

import { prisma } from "@/lib/prisma";

const AUTH_URL = "https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token";
const TRACK_URL = "https://trackapi.thailandpost.co.th/post/api/v1/track";
const WEBHOOK_AUTH_URL = "https://trackwebhook.thailandpost.co.th/post/api/v1/authenticate/token";
const WEBHOOK_URL = "https://trackwebhook.thailandpost.co.th/post/api/v1/hook";

/** API รับได้สูงสุด 100 บาร์โค้ดต่อครั้ง เกินกว่านี้ต้องใช้ endpoint แบบ batch ที่ส่งผลกลับทางอีเมล */
export const MAX_BARCODES_PER_REQUEST = 100;
/** กันการยิงถี่เกินจนโดน rate limit (เอกสารระบุ 15 ครั้ง/3 วินาที) */
const DELAY_BETWEEN_CHUNKS_MS = 400;
const REQUEST_TIMEOUT_MS = 20_000;

const SERVICE_KEY = "thailandpost";
const WEBHOOK_SERVICE_KEY = "thailandpost_webhook";
/** เผื่อเวลาก่อน token หมดอายุจริง กันกรณี request ออกไปตอนใกล้หมดอายุพอดี */
const TOKEN_SAFETY_MARGIN_MS = 60 * 60 * 1000;

export class ThailandPostError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ThailandPostError";
  }
}

export type TrackingEventPayload = {
  barcode: string;
  statusCode: string;
  statusText: string;
  location: string | null;
  postcode: string | null;
  eventAt: Date;
};

export function isThailandPostConfigured(): boolean {
  return Boolean(process.env.THAILANDPOST_API_KEY?.trim());
}

export function isThailandPostWebhookConfigured(): boolean {
  return isThailandPostConfigured() && Boolean(process.env.THAILANDPOST_WEBHOOK_SECRET?.trim());
}

/**
 * เลขพัสดุไปรษณีย์ไทยมาตรฐาน UPU: ตัวอักษร 2 ตัว + ตัวเลข 9 หลัก + รหัสประเทศ 2 ตัว เช่น EY145587896TH
 * ตรวจแค่รูปแบบเพื่อไม่ยิง API ทิ้งกับเลขของขนส่งเจ้าอื่น ส่วนเลขจะมีอยู่จริงหรือไม่ให้ API ตอบ
 */
const BARCODE_PATTERN = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export function normalizeBarcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isThailandPostBarcode(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return BARCODE_PATTERN.test(normalizeBarcode(raw));
}

/** ชื่อขนส่งที่ผู้ใช้พิมพ์เองในฟอร์ม จึงต้องเดาจากคำที่พบบ่อยแทนการเทียบแบบตรงตัว */
const THAILAND_POST_COURIER_HINTS = [
  "ไปรษณีย์",
  "ปณท",
  "thailand post",
  "thailandpost",
  "thai post",
  "thaipost",
  "ems",
];

export function isThailandPostCourier(courier: string | null | undefined): boolean {
  if (!courier) return false;
  const value = courier.trim().toLowerCase();
  return THAILAND_POST_COURIER_HINTS.some((hint) => value.includes(hint));
}

/** ลิงก์หน้าติดตามพัสดุสาธารณะ ใช้ได้แม้ยังไม่ได้ตั้งค่า API key */
export function publicTrackingUrl(barcode: string): string {
  return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(normalizeBarcode(barcode))}`;
}

// ---------------------------------------------------------------------------
// Access token
// ---------------------------------------------------------------------------

/** cache ในหน่วยความจำของ instance ปัจจุบัน ลดการ query DB ในคำขอที่ยิงติด ๆ กัน */
let memoryToken: { token: string; expiresAt: Date } | null = null;

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ThailandPostError("เชื่อมต่อ API ไปรษณีย์ไทยไม่สำเร็จ (หมดเวลารอ)", error);
    }
    throw new ThailandPostError("เชื่อมต่อ API ไปรษณีย์ไทยไม่สำเร็จ", error);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) {
    // ตัดข้อความให้สั้นก่อนเก็บ/แสดง เพราะ body ที่ error อาจเป็นหน้า HTML ยาว ๆ
    throw new ThailandPostError(
      `API ไปรษณีย์ไทยตอบกลับ ${response.status}: ${text.slice(0, 200) || response.statusText}`
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ThailandPostError("API ไปรษณีย์ไทยตอบกลับไม่ใช่ JSON", error);
  }
}

async function requestNewToken(url: string, apiKey: string): Promise<{ token: string; expiresAt: Date }> {
  const data = fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${apiKey}` },
    body: "{}",
  });

  const parsed = (await data) as { token?: unknown; expire?: unknown; message?: unknown };
  if (typeof parsed.token !== "string" || !parsed.token) {
    const message = typeof parsed.message === "string" ? parsed.message : "ไม่ได้รับ token";
    throw new ThailandPostError(`ขอ token จากไปรษณีย์ไทยไม่สำเร็จ: ${message}`);
  }

  // ถ้าอ่าน expire ไม่ได้ ให้ถือว่าอายุ 7 วัน — สั้นกว่าที่เอกสารระบุไว้ เพื่อให้ขอใหม่เร็วขึ้นแทนที่จะใช้ token ที่ตายแล้ว
  const expireRaw = typeof parsed.expire === "string" ? Date.parse(parsed.expire) : Number.NaN;
  const expiresAt = Number.isFinite(expireRaw)
    ? new Date(expireRaw)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return { token: parsed.token, expiresAt };
}

function isUsable(entry: { expiresAt: Date } | null): boolean {
  return Boolean(entry && entry.expiresAt.getTime() - TOKEN_SAFETY_MARGIN_MS > Date.now());
}

async function getAccessToken(service: string, authUrl: string, forceRefresh = false): Promise<string> {
  const apiKey = process.env.THAILANDPOST_API_KEY?.trim();
  if (!apiKey) {
    throw new ThailandPostError("ยังไม่ได้ตั้งค่า THAILANDPOST_API_KEY");
  }

  if (!forceRefresh && service === SERVICE_KEY && isUsable(memoryToken)) {
    return memoryToken!.token;
  }

  if (!forceRefresh) {
    const stored = await prisma.serviceToken.findUnique({ where: { service } });
    if (stored && isUsable(stored)) {
      if (service === SERVICE_KEY) memoryToken = { token: stored.token, expiresAt: stored.expiresAt };
      return stored.token;
    }
  }

  const fresh = await requestNewToken(authUrl, apiKey);
  await prisma.serviceToken.upsert({
    where: { service },
    create: { service, token: fresh.token, expiresAt: fresh.expiresAt },
    update: { token: fresh.token, expiresAt: fresh.expiresAt },
  });
  if (service === SERVICE_KEY) memoryToken = fresh;
  return fresh.token;
}

/** ใช้ในเทสต์/หน้า diagnostics เพื่อบังคับล้าง cache ในหน่วยความจำ */
export function clearTokenCache(): void {
  memoryToken = null;
}

// ---------------------------------------------------------------------------
// /track
// ---------------------------------------------------------------------------

type RawItem = {
  barcode?: unknown;
  status?: unknown;
  status_description?: unknown;
  status_date?: unknown;
  location?: unknown;
  postcode?: unknown;
};

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * status_date มาในรูป "2565-07-11 14:05:00+07:00" หรือ ISO ปกติ
 * ปีอาจเป็น พ.ศ. จึงต้องแปลงกลับเป็น ค.ศ. ก่อน ไม่งั้นจะได้วันที่ในอนาคตอีก 543 ปี
 */
export function parseThaiTimestamp(raw: unknown): Date | null {
  const value = str(raw);
  if (!value) return null;

  const yearMatch = /^(\d{4})/.exec(value);
  let normalized = value;
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    // ปี พ.ศ. ปัจจุบันมากกว่า 2500 เสมอ ส่วนปี ค.ศ. ยังไม่ถึง — ใช้เส้นแบ่งนี้แยกได้อย่างปลอดภัย
    if (year > 2400) normalized = `${year - 543}${value.slice(yearMatch[1].length)}`;
  }
  // แทนที่ช่องว่างระหว่างวันที่กับเวลาด้วย "T" ให้ Date.parse อ่านได้แน่นอนทุก runtime
  normalized = normalized.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T");

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function toEvents(barcode: string, rawItems: unknown): TrackingEventPayload[] {
  if (!Array.isArray(rawItems)) return [];

  const events: TrackingEventPayload[] = [];
  for (const raw of rawItems as RawItem[]) {
    const eventAt = parseThaiTimestamp(raw.status_date);
    const statusCode = str(raw.status);
    // ไม่มีเวลาหรือไม่มีรหัสสถานะ = ระบุเหตุการณ์ไม่ได้ ข้ามไปดีกว่าเก็บแถวที่เรียงลำดับไม่ได้
    if (!eventAt || !statusCode) continue;
    events.push({
      barcode: str(raw.barcode) ?? barcode,
      statusCode,
      statusText: str(raw.status_description) ?? statusCode,
      location: str(raw.location),
      postcode: str(raw.postcode),
      eventAt,
    });
  }
  // เรียงเก่า → ใหม่ ให้เหตุการณ์ล่าสุดอยู่ท้ายเสมอ ไม่ต้องเดาลำดับที่ API ส่งมา
  return events.sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
}

export type TrackResult = {
  events: Map<string, TrackingEventPayload[]>;
  /** โควตาที่ใช้ไปวันนี้ตามที่ API แจ้งกลับมา ใช้เตือนผู้ใช้ก่อนเต็ม */
  quota: { used: number; limit: number } | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * ดึงสถานะพัสดุจากไปรษณีย์ไทย คืนเป็น Map ของ barcode → เหตุการณ์เรียงตามเวลา
 * บาร์โค้ดที่ API ไม่รู้จักจะไม่ปรากฏใน Map (ไม่ throw) ผู้เรียกต้องจัดการเองว่าจะรายงานอย่างไร
 */
export async function trackBarcodes(barcodes: string[], language: "TH" | "EN" = "TH"): Promise<TrackResult> {
  const unique = [...new Set(barcodes.map(normalizeBarcode).filter((b) => b.length > 0))];
  const events = new Map<string, TrackingEventPayload[]>();
  if (unique.length === 0) return { events, quota: null };

  let quota: TrackResult["quota"] = null;
  const chunks = chunk(unique, MAX_BARCODES_PER_REQUEST);

  for (const [index, group] of chunks.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));

    const call = async (token: string) =>
      fetchJson(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ status: "all", language, barcode: group }),
      });

    let payload: unknown;
    try {
      payload = await call(await getAccessToken(SERVICE_KEY, AUTH_URL));
    } catch (error) {
      // token ที่ cache ไว้อาจถูกเพิกถอนก่อนหมดอายุ ลองขอใหม่หนึ่งครั้งก่อนยอมแพ้
      const unauthorized = error instanceof ThailandPostError && /\b401\b|\b403\b/.test(error.message);
      if (!unauthorized) throw error;
      clearTokenCache();
      payload = await call(await getAccessToken(SERVICE_KEY, AUTH_URL, true));
    }

    const body = payload as {
      status?: unknown;
      message?: unknown;
      response?: {
        items?: Record<string, unknown> | unknown[];
        track_count?: { count_number?: unknown; track_count_limit?: unknown };
      };
    };

    if (body.status === false) {
      const message = typeof body.message === "string" ? body.message : "ไม่ทราบสาเหตุ";
      throw new ThailandPostError(`API ไปรษณีย์ไทยปฏิเสธคำขอ: ${message}`);
    }

    const items = body.response?.items;
    // endpoint ปกติคืน items เป็น object คีย์ด้วยบาร์โค้ด ส่วน batch คืนเป็น array ว่าง
    if (items && !Array.isArray(items)) {
      for (const [barcode, rawItems] of Object.entries(items)) {
        const parsed = toEvents(normalizeBarcode(barcode), rawItems);
        if (parsed.length > 0) events.set(normalizeBarcode(barcode), parsed);
      }
    }

    const count = body.response?.track_count;
    const used = Number(count?.count_number);
    const limit = Number(count?.track_count_limit);
    if (Number.isFinite(used) && Number.isFinite(limit)) quota = { used, limit };
  }

  return { events, quota };
}

// ---------------------------------------------------------------------------
// Webhook (ให้ไปรษณีย์ไทย push สถานะมาหาเราแทนการ poll)
// ---------------------------------------------------------------------------

/**
 * ลงทะเบียนเลขพัสดุกับ webhook ของไปรษณีย์ไทย
 * เมื่อพัสดุมีความเคลื่อนไหว ไปรษณีย์ไทยจะ POST มาที่ URL ที่ตั้งไว้ในหน้าโปรไฟล์ผู้พัฒนา
 * คืนรายการบาร์โค้ดที่ลงทะเบียนสำเร็จ
 */
export async function registerWebhookBarcodes(barcodes: string[]): Promise<string[]> {
  const unique = [...new Set(barcodes.map(normalizeBarcode).filter((b) => b.length > 0))];
  if (unique.length === 0) return [];

  const registered: string[] = [];
  for (const [index, group] of chunk(unique, MAX_BARCODES_PER_REQUEST).entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CHUNKS_MS));

    const token = await getAccessToken(WEBHOOK_SERVICE_KEY, WEBHOOK_AUTH_URL);
    const payload = (await fetchJson(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({ status: "all", language: "TH", barcode: group }),
    })) as { status?: unknown; message?: unknown };

    if (payload.status === false) {
      const message = typeof payload.message === "string" ? payload.message : "ไม่ทราบสาเหตุ";
      throw new ThailandPostError(`ลงทะเบียน webhook ไม่สำเร็จ: ${message}`);
    }
    registered.push(...group);
  }
  return registered;
}

/** แปลง payload ที่ไปรษณีย์ไทย push เข้ามาให้เป็นรูปแบบเดียวกับที่ได้จากการ poll */
export function parseWebhookPayload(body: unknown): TrackingEventPayload[] {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  const events: TrackingEventPayload[] = [];
  for (const raw of items as RawItem[]) {
    const barcode = str(raw.barcode);
    const eventAt = parseThaiTimestamp(raw.status_date);
    const statusCode = str(raw.status);
    if (!barcode || !eventAt || !statusCode) continue;
    events.push({
      barcode: normalizeBarcode(barcode),
      statusCode,
      statusText: str(raw.status_description) ?? statusCode,
      location: str(raw.location),
      postcode: str(raw.postcode),
      eventAt,
    });
  }
  return events.sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
}
