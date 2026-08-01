export const ROLE_NAMES = [
  "WAREHOUSE_STAFF",
  "ADMIN_CS",
  "SUPERVISOR",
  "ACCOUNTING",
  "OWNER",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const MODULE_KEYS = [
  "merchants",
  "products",
  "inbound",
  "inventory",
  "orders",
  "pickpack",
  "returns",
  "billing",
  "reports",
  "users",
  "activityLog",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleAccess = "none" | "read" | "write";

export const ROLE_LABELS: Record<RoleName, string> = {
  WAREHOUSE_STAFF: "พนักงานหยิบ-แพ็ค",
  ADMIN_CS: "แอดมิน/CS",
  SUPERVISOR: "หัวหน้าคลัง",
  ACCOUNTING: "บัญชี",
  OWNER: "เจ้าของ",
};

// อ้างอิงตามตาราง Roles & Permissions ในสเปกข้อ 5
export const ROLE_PERMISSIONS: Record<RoleName, Record<ModuleKey, ModuleAccess>> = {
  WAREHOUSE_STAFF: {
    merchants: "none",
    products: "read",
    inbound: "write",
    inventory: "read",
    orders: "none",
    pickpack: "write",
    returns: "none",
    billing: "none",
    reports: "none",
    users: "none",
    activityLog: "none",
  },
  ADMIN_CS: {
    merchants: "read",
    products: "read",
    inbound: "none",
    inventory: "read",
    orders: "write",
    pickpack: "none",
    returns: "read",
    billing: "none",
    reports: "none",
    users: "none",
    activityLog: "none",
  },
  SUPERVISOR: {
    merchants: "read",
    products: "write",
    inbound: "write",
    inventory: "write",
    orders: "write",
    pickpack: "write",
    returns: "write",
    billing: "none",
    reports: "read",
    users: "write",
    activityLog: "read",
  },
  ACCOUNTING: {
    merchants: "read",
    products: "none",
    inbound: "none",
    inventory: "none",
    orders: "read",
    pickpack: "none",
    returns: "none",
    billing: "write",
    reports: "read",
    users: "none",
    activityLog: "none",
  },
  OWNER: {
    merchants: "write",
    products: "write",
    inbound: "write",
    inventory: "write",
    orders: "write",
    pickpack: "write",
    returns: "write",
    billing: "write",
    reports: "read",
    users: "write",
    activityLog: "read",
  },
};

export function getAccess(role: RoleName, moduleKey: ModuleKey): ModuleAccess {
  return ROLE_PERMISSIONS[role]?.[moduleKey] ?? "none";
}

export function canRead(role: RoleName, moduleKey: ModuleKey): boolean {
  return getAccess(role, moduleKey) !== "none";
}

export function canWrite(role: RoleName, moduleKey: ModuleKey): boolean {
  return getAccess(role, moduleKey) === "write";
}
