import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // exceljs ใช้ API ของ Node โดยตรง (stream/zip) จึงให้ require ตรงแทนการ bundle
  serverExternalPackages: ["exceljs"],
  experimental: {
    // ค่าเริ่มต้นของ Server Action คือ 1MB ซึ่งเล็กเกินไปสำหรับไฟล์ Excel นำเข้าสต็อก
    // ตัวแอ็กชันเองยังจำกัดขนาดไฟล์ไว้ที่ 2MB อีกชั้นหนึ่ง
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
