/**
 * PDF utilities — browser-side download helpers built on @react-pdf/renderer.
 *
 * Usage from a "use client" component:
 *
 *   import { downloadQuotePDF } from "@/lib/pdf";
 *   await downloadQuotePDF({ ...quoteProps });
 *
 * The pdf() function is dynamically imported so the heavy renderer is only
 * loaded when the user actually triggers a download — keeps initial bundle
 * small.
 */
import type { QuotePDFProps } from "./QuotePDF";
import type { InvoicePDFProps } from "./InvoicePDF";
import type { ReceiptVoucherPDFProps } from "./ReceiptVoucherPDF";

// ─── Quote ────────────────────────────────────────────────────────────────

export async function downloadQuotePDF(props: QuotePDFProps): Promise<Blob> {
  const blob = await renderQuotePDF(props);
  triggerDownload(blob, `${props.quoteId}.pdf`);
  return blob;
}

export async function renderQuotePDF(props: QuotePDFProps): Promise<Blob> {
  // Lazy import keeps the ~500 KB renderer out of the initial bundle.
  const { pdf } = await import("@react-pdf/renderer");
  const { QuotePDF } = await import("./QuotePDF");
  return await pdf(<QuotePDF {...props} />).toBlob();
}

// ─── Invoice ──────────────────────────────────────────────────────────────

export async function downloadInvoicePDF(props: InvoicePDFProps): Promise<Blob> {
  const blob = await renderInvoicePDF(props);
  triggerDownload(blob, `${props.invoice.id}.pdf`);
  return blob;
}

export async function renderInvoicePDF(props: InvoicePDFProps): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  const { InvoicePDF } = await import("./InvoicePDF");
  return await pdf(<InvoicePDF {...props} />).toBlob();
}

// ─── Receipt Voucher ──────────────────────────────────────────────────────

export async function downloadReceiptVoucherPDF(props: ReceiptVoucherPDFProps): Promise<Blob> {
  const blob = await renderReceiptVoucherPDF(props);
  const name = props.payment.receipt_voucher_no ?? `RV-${props.payment.id.slice(0, 8)}`;
  triggerDownload(blob, `${name}.pdf`);
  return blob;
}

export async function renderReceiptVoucherPDF(props: ReceiptVoucherPDFProps): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  const { ReceiptVoucherPDF } = await import("./ReceiptVoucherPDF");
  return await pdf(<ReceiptVoucherPDF {...props} />).toBlob();
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick to let the browser commit the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { QuotePDFProps } from "./QuotePDF";
