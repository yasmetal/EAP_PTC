"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            ระบบขัดข้อง
          </h1>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาต่อเนื่อง กรุณาแจ้งผู้ดูแลระบบ
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              background: "#111",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
