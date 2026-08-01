import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import path from "path";
import type { Invoice, InvoiceItem, Merchant } from "@prisma/client";
import { formatThaiDate, formatBaht } from "@/lib/format";
import { INVOICE_STATUS_LABELS } from "@/lib/labels";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/noto-sans-thai/files");

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "NotoSansThai",
    fonts: [
      { src: path.join(fontDir, "noto-sans-thai-thai-400-normal.woff"), fontWeight: 400 },
      { src: path.join(fontDir, "noto-sans-thai-thai-700-normal.woff"), fontWeight: 700 },
    ],
  });
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansThai", padding: 40, fontSize: 10, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 700 },
  invoiceNo: { fontSize: 11, marginTop: 4, color: "#555" },
  section: { marginBottom: 16 },
  label: { color: "#777", fontSize: 9 },
  value: { fontSize: 11, marginTop: 2 },
  table: { marginTop: 8, borderTop: "1pt solid #ccc" },
  tableRow: { flexDirection: "row", borderBottom: "1pt solid #eee", paddingVertical: 6 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 6, fontWeight: 700 },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnitPrice: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalLabel: { fontSize: 12, fontWeight: 700, marginRight: 12 },
  totalValue: { fontSize: 12, fontWeight: 700 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#999" },
});

type InvoiceWithRelations = Invoice & { merchant: Merchant; items: InvoiceItem[] };

function InvoiceDocument({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>ใบแจ้งหนี้ค่าบริการ</Text>
            <Text style={styles.invoiceNo}>เลขที่ {invoice.invoiceNo}</Text>
          </View>
          <View>
            <Text style={styles.label}>สถานะ</Text>
            <Text style={styles.value}>{INVOICE_STATUS_LABELS[invoice.status]}</Text>
          </View>
        </View>

        <View style={[styles.section, { flexDirection: "row", justifyContent: "space-between" }]}>
          <View>
            <Text style={styles.label}>เรียกเก็บจาก</Text>
            <Text style={styles.value}>{invoice.merchant.name}</Text>
            <Text style={styles.value}>{invoice.merchant.contactEmail}</Text>
          </View>
          <View>
            <Text style={styles.label}>รอบบิล</Text>
            <Text style={styles.value}>
              {formatThaiDate(invoice.periodStart)} – {formatThaiDate(invoice.periodEnd)}
            </Text>
            <Text style={styles.label}>วันที่ออกใบแจ้งหนี้</Text>
            <Text style={styles.value}>{formatThaiDate(invoice.issuedAt)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDescription}>รายละเอียด</Text>
            <Text style={styles.colQty}>จำนวน</Text>
            <Text style={styles.colUnitPrice}>ราคา/หน่วย</Text>
            <Text style={styles.colAmount}>รวม</Text>
          </View>
          {invoice.items.map((item) => (
            <View style={styles.tableRow} key={item.id}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colUnitPrice}>{formatBaht(item.unitPrice.toString())}</Text>
              <Text style={styles.colAmount}>{formatBaht(item.amount.toString())}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>ยอดรวมทั้งสิ้น</Text>
          <Text style={styles.totalValue}>{formatBaht(invoice.totalAmount.toString())}</Text>
        </View>

        <Text style={styles.footer}>เอกสารนี้ออกโดยระบบ ERP คลังสินค้า — ใช้สำหรับการเรียกเก็บค่าบริการภายในเท่านั้น</Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoiceWithRelations): Promise<Buffer> {
  ensureFontRegistered();
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
