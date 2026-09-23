/**
 * SRI SS GAS AGENCY — Customer Sale Bill & Invoice PDF Generator
 * Generates official, print-ready A4 Portrait Bills according to the approved layout.
 * Operational gas agency bill (not marketing/advertising).
 */

import { jsPDF } from 'jspdf';
import { logAudit } from './db';

export interface InvoiceLineItem {
  description: string;
  cylinder_type_id?: string;
  hsn?: string;
  quantity: number;
  rate: number;
  taxableAmount?: number;
  gstRate?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total: number;
}

export interface InvoiceData {
  invoiceType?: 'regular' | 'gst';
  invoiceNumber: string;
  invoiceDate: string;
  paymentMode?: string;
  placeOfSupply?: string;
  supplyDate?: string;
  vehicleNumber?: string;

  // Seller Details (Sri SS Gas Agency)
  agencyName?: string;
  agencyAddress?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyGstin?: string;
  agencyState?: string;
  agencyStateCode?: string;

  // Customer / Buyer Details
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerStateCode?: string;
  customerGstin?: string;
  customerCode?: string;

  // Sale Items
  items: InvoiceLineItem[];

  // Dynamic Empty Cylinder Return (Informational Only - ₹0)
  emptyReturned?: {
    quantity: number;
    sizeLabel: string;
  } | null;

  // Financials
  subtotal: number;
  discount?: number;
  securityDeposit?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalTax?: number;
  roundOff?: number;
  grandTotal: number;

  notes?: string;
}

/**
 * Converts a numeric amount to Indian English words
 */
export function numberToWordsINR(amount: number): string {
  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  if (num === 0 && paise === 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigit(n: number): string {
    if (n === 0) return '';
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return twoDigits[n - 10];
    const t = Math.floor(n / 10);
    const s = n % 10;
    return `${tens[t]}${s > 0 ? ' ' + singleDigits[s] : ''}`;
  }

  function convertThreeDigit(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (h > 0) res += `${singleDigits[h]} Hundred`;
    if (rem > 0) {
      res += (res.length > 0 ? ' and ' : '') + convertTwoDigit(rem);
    }
    return res;
  }

  let crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  let thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  let hundred = rem;

  let words = '';
  if (crore > 0) words += `${convertThreeDigit(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigit(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigit(thousand)} Thousand `;
  if (hundred > 0) words += `${convertThreeDigit(hundred)} `;

  words = words.trim();
  let result = words ? `Rupees ${words}` : 'Rupees';

  if (paise > 0) {
    result += ` and Paise ${convertTwoDigit(paise)}`;
  }

  return `${result} Only`;
}

/**
 * Loads an image url into a base64 Data URL for jsPDF embedding
 */
async function loadBase64Image(url: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } else {
      // Node.js fallback (used in unit tests / test scripts)
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const fs: any = await dynamicImport('fs');
      const path: any = await dynamicImport('path');
      const cleanPath = url.startsWith('/') ? url.slice(1) : url;
      const candidatePaths = [
        path.resolve(cleanPath),
        path.resolve('public', cleanPath),
        path.resolve('dist', cleanPath),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          const ext = p.endsWith('.png') ? 'png' : 'jpeg';
          return `data:image/${ext};base64,` + buf.toString('base64');
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Loads a font file as raw base64 for jsPDF embedding
 */
async function loadFontBase64(url: string): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const b64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(b64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } else {
      // Node.js environment
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const fs: any = await dynamicImport('fs');
      const path: any = await dynamicImport('path');
      const cleanPath = url.startsWith('/') ? url.slice(1) : url;
      const candidatePaths = [
        path.resolve(cleanPath),
        path.resolve('public', cleanPath),
        path.resolve('dist', cleanPath),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          return buf.toString('base64');
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Clean cylinder item description to match approved standard format:
 * "12 kg LPG Cylinder" (removes "(Filled)" or "(filled)")
 */
export function formatCylinderItemDescription(desc: string): string {
  if (!desc) return '';
  return desc.replace(/\s*\((?:filled|full)\)/gi, '').trim();
}

/**
 * Format dynamic empty cylinder label:
 * e.g. "Empty - 1 (12KG)" or "Empty - 2 (17KG)"
 */
export function formatEmptyReturnLabel(quantity: number, sizeLabel: string): string {
  const cleanSize = sizeLabel.toUpperCase().replace(/\s+/g, '').replace('KG', '') + 'KG';
  return `Empty - ${quantity} (${cleanSize})`;
}

/**
 * Generates an official, approved A4 portrait Bill PDF matching the target design
 */
export async function generateCustomerInvoicePdf(invoice: InvoiceData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = margin;

  // Colors matching the approved bill
  const brandRed = [204, 0, 0]; // #CC0000
  const darkGray = [23, 23, 23]; // #171717
  const borderGray = [209, 213, 219]; // #D1D5DB (gray-300)
  const boxHeaderBg = [253, 242, 242]; // #FDF2F2 (soft pink tint)

  // Load logo, signature & professional Unicode fonts
  const [logoB64, sigB64, fontRegularB64, fontBoldB64] = await Promise.all([
    loadBase64Image('/assets/supergas-horizontal-logo.png') || loadBase64Image('/assets/sri-ss-gas-agency-logo.png'),
    loadBase64Image('/assets/authorized-signature.png') || loadBase64Image('/assets/authorized-signature.jpg'),
    loadFontBase64('/assets/fonts/NotoSans-Regular.ttf'),
    loadFontBase64('/assets/fonts/NotoSans-Bold.ttf'),
  ]);

  // Consistent professional sans-serif typography system
  let activeFont = 'helvetica';
  if (fontRegularB64 && fontBoldB64) {
    try {
      doc.addFileToVFS('NotoSans-Regular.ttf', fontRegularB64);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      doc.addFileToVFS('NotoSans-Bold.ttf', fontBoldB64);
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
      activeFont = 'NotoSans';
    } catch {
      activeFont = 'helvetica';
    }
  }

  // ==========================================================
  // 1. HEADER (Top-Left: Agency Info | Top-Right: SUPERGAS Logo)
  // ==========================================================
  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setFontSize(15);
  doc.setFont(activeFont, 'bold');
  doc.text('SRI SS GAS AGENCY', margin, y + 5);

  doc.setFontSize(8);
  doc.setFont(activeFont, 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('10/699, MP COMPLEX, Karaipudur Main Rd, Chinnakarai,', margin, y + 10);
  doc.text('Tiruppur, Tamil Nadu 641605', margin, y + 14.5);
  doc.text('Phone: +91 86672109929   |   Email: srissgasagency@gmail.com', margin, y + 19);

  // Top-right: SUPERGAS Logo
  if (logoB64) {
    const logoW = 44;
    const logoH = 11;
    const logoX = pageWidth - margin - logoW;
    doc.addImage(logoB64, 'PNG', logoX, y + 5, logoW, logoH);
  }

  y += 24;

  // Red horizontal divider line
  doc.setDrawColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  // ==========================================================
  // 2. INVOICE DETAILS & BILLED TO / CUSTOMER (Side-by-Side Boxes)
  // ==========================================================
  const gap = 4;
  const boxW = (contentWidth - gap) / 2; // ~89mm each
  const boxH = 34;
  const boxHeaderH = 6.5;

  // --- Left Box: INVOICE DETAILS ---
  const leftX = margin;
  doc.setFillColor(boxHeaderBg[0], boxHeaderBg[1], boxHeaderBg[2]);
  doc.rect(leftX, y, boxW, boxHeaderH, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.rect(leftX, y, boxW, boxH, 'S');
  doc.line(leftX, y + boxHeaderH, leftX + boxW, y + boxHeaderH);

  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setFontSize(8);
  doc.setFont(activeFont, 'bold');
  doc.text('INVOICE DETAILS', leftX + 3.5, y + 4.5);

  doc.setFontSize(7.5);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  const leftRows = [
    { label: 'Invoice No', val: invoice.invoiceNumber },
    { label: 'Invoice Date', val: invoice.invoiceDate },
    { label: 'Payment Mode', val: (invoice.paymentMode || 'UPI').toUpperCase() },
    { label: 'Place of Supply', val: invoice.placeOfSupply || 'Tamil Nadu' },
  ];

  leftRows.forEach((r, idx) => {
    const rowY = y + boxHeaderH + 5 + idx * 5.2;
    doc.setFont(activeFont, 'normal');
    doc.text(r.label, leftX + 3.5, rowY);
    doc.text(':', leftX + 28, rowY);
    doc.setFont(activeFont, idx === 0 || idx === 2 ? 'bold' : 'normal');
    doc.text(r.val, leftX + 32, rowY);
  });

  // --- Right Box: BILLED TO / CUSTOMER ---
  const rightX = margin + boxW + gap;
  doc.setFillColor(boxHeaderBg[0], boxHeaderBg[1], boxHeaderBg[2]);
  doc.rect(rightX, y, boxW, boxHeaderH, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(rightX, y, boxW, boxH, 'S');
  doc.line(rightX, y + boxHeaderH, rightX + boxW, y + boxHeaderH);

  doc.setTextColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setFontSize(8);
  doc.setFont(activeFont, 'bold');
  doc.text('BILLED TO / CUSTOMER', rightX + 3.5, y + 4.5);

  const fullAddress = [invoice.customerAddress, invoice.customerCity].filter(Boolean).join(', ') || 'Mahalakshmi nagar, Tiruppur';
  const rightRows: Array<{ label: string; val: string; bold: boolean }> = [
    { label: 'Name', val: invoice.customerName, bold: true },
    { label: 'Address', val: fullAddress, bold: false },
    { label: 'Phone', val: invoice.customerPhone || '7395803653', bold: false },
  ];
  if (invoice.customerGstin) {
    rightRows.push({ label: 'GSTIN', val: invoice.customerGstin, bold: false });
  }

  rightRows.forEach((r, idx) => {
    const rowY = y + boxHeaderH + 5 + idx * 5.2;
    doc.setFont(activeFont, 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(r.label, rightX + 3.5, rowY);
    doc.text(':', rightX + 18, rowY);
    doc.setFont(activeFont, r.bold ? 'bold' : 'normal');
    doc.text(r.val, rightX + 22, rowY, { maxWidth: boxW - 24 });
  });

  y += boxH + 6;

  // ==========================================================
  // 3. ITEM TABLE (EXACTLY 5 COLUMNS) WITH SOLID RED HEADER
  // S.No. | Item Description | Rate (₹) | Quantity | Amount (₹)
  // ==========================================================
  interface ColDef {
    header: string;
    width: number;
    align: 'left' | 'right' | 'center';
  }

  const cols: ColDef[] = [
    { header: 'S.No.', width: 14, align: 'center' },
    { header: 'Item Description', width: 84, align: 'left' },
    { header: 'Rate (₹)', width: 28, align: 'center' },
    { header: 'Quantity', width: 24, align: 'center' },
    { header: 'Amount (₹)', width: 32, align: 'right' },
  ];

  // Draw Table Header
  const tableHeaderHeight = 7.5;
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, 'S');

  doc.setFontSize(8);
  doc.setFont(activeFont, 'bold');
  doc.setTextColor(255, 255, 255);

  let currentX = margin;
  cols.forEach((c) => {
    let textX = currentX + 3;
    if (c.align === 'center') textX = currentX + c.width / 2;
    if (c.align === 'right') textX = currentX + c.width - 3;
    doc.text(c.header, textX, y + 5.2, { align: c.align });

    // Header column separator
    doc.setDrawColor(255, 255, 255);
    doc.line(currentX + c.width, y, currentX + c.width, y + tableHeaderHeight);
    currentX += c.width;
  });

  y += tableHeaderHeight;

  // Draw Billable Item Rows
  doc.setFont(activeFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  const rowHeight = 7.5;

  invoice.items.forEach((item, index) => {
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    currentX = margin;

    // 1. S.No.
    doc.text(String(index + 1), currentX + cols[0].width / 2, y + 5.2, { align: 'center' });
    doc.line(currentX + cols[0].width, y, currentX + cols[0].width, y + rowHeight);
    currentX += cols[0].width;

    // 2. Item Description
    doc.setFont(activeFont, 'normal');
    const cleanDesc = formatCylinderItemDescription(item.description);
    doc.text(cleanDesc, currentX + 3, y + 5.2);
    doc.line(currentX + cols[1].width, y, currentX + cols[1].width, y + rowHeight);
    currentX += cols[1].width;

    // 3. Rate (₹)
    doc.text(item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), currentX + cols[2].width / 2, y + 5.2, { align: 'center' });
    doc.line(currentX + cols[2].width, y, currentX + cols[2].width, y + rowHeight);
    currentX += cols[2].width;

    // 4. Quantity
    doc.text(String(item.quantity), currentX + cols[3].width / 2, y + 5.2, { align: 'center' });
    doc.line(currentX + cols[3].width, y, currentX + cols[3].width, y + rowHeight);
    currentX += cols[3].width;

    // 5. Amount (₹)
    const itemAmount = item.rate * item.quantity;
    doc.text(itemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), currentX + cols[4].width - 3, y + 5.2, { align: 'right' });

    y += rowHeight;
  });

  // ==========================================================
  // 4. BOTTOM SECTION: TAX SUMMARY & NOTES
  // ==========================================================
  const isGstInvoice = invoice.invoiceType === 'gst';

  const notesParts: string[] = [];
  if (invoice.emptyReturned && invoice.emptyReturned.quantity > 0) {
    notesParts.push(formatEmptyReturnLabel(invoice.emptyReturned.quantity, invoice.emptyReturned.sizeLabel));
  }
  if (invoice.securityDeposit && invoice.securityDeposit > 0) {
    notesParts.push(`Security Deposit: ₹${invoice.securityDeposit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (isGstInvoice) {
    // --- GST TAX INVOICE BREAKDOWN ---
    const leftColSpanW = cols[0].width + cols[1].width; // 98mm
    const rightColSpanW = cols[2].width + cols[3].width + cols[4].width; // 84mm

    const isInterState = (invoice.igstAmount ?? 0) > 0;
    const taxableVal = invoice.taxableAmount ?? invoice.subtotal;
    const cgstVal = invoice.cgstAmount ?? 0;
    const sgstVal = invoice.sgstAmount ?? 0;
    const igstVal = invoice.igstAmount ?? 0;
    const roundOffVal = invoice.roundOff ?? 0;

    interface SummaryRow {
      label: string;
      value: string;
      isTotal?: boolean;
    }

    const summaryRows: SummaryRow[] = [
      {
        label: 'Taxable Value / Net Price',
        value: `₹${taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    ];

    if (isInterState) {
      summaryRows.push({
        label: 'IGST (18%)',
        value: `₹${igstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
    } else {
      summaryRows.push(
        {
          label: 'CGST (9%)',
          value: `₹${cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        {
          label: 'SGST (9%)',
          value: `₹${sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        }
      );
    }

    if (roundOffVal !== 0 || isGstInvoice) {
      summaryRows.push({
        label: 'Round Off',
        value: `${roundOffVal > 0 ? '+' : ''}₹${roundOffVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
    }

    summaryRows.push({
      label: 'Grand Total',
      value: `₹${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isTotal: true,
    });

    const gstRowH = 6.5;
    const totalGstSummaryH = summaryRows.length * gstRowH;

    // Draw Left Box (Empty Returns, Security Deposit, Place of Supply info)
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, leftColSpanW, totalGstSummaryH, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, leftColSpanW, totalGstSummaryH, 'S');

    let leftTextY = y + 4.8;
    doc.setFontSize(7.5);

    if (notesParts.length > 0) {
      doc.setFont(activeFont, 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      notesParts.forEach((note) => {
        doc.text(note, margin + 3.5, leftTextY);
        leftTextY += 5;
      });
    }

    doc.setFont(activeFont, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Place of Supply: ${invoice.placeOfSupply || (isInterState ? (invoice.customerState || 'Other') : 'Tamil Nadu (33)')}`, margin + 3.5, leftTextY);
    leftTextY += 4.5;
    doc.text('Tax Payable on Reverse Charge: No', margin + 3.5, leftTextY);

    // Draw Right Summary Rows
    let summaryY = y;
    summaryRows.forEach((sRow) => {
      const rowX = margin + leftColSpanW;

      if (sRow.isTotal) {
        // Grand Total Row with Solid Red Background
        doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
        doc.rect(rowX, summaryY, rightColSpanW, gstRowH, 'F');
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.rect(rowX, summaryY, rightColSpanW, gstRowH, 'S');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont(activeFont, 'bold');
        doc.text(sRow.label, rowX + 3.5, summaryY + 4.6);
        doc.text(sRow.value, rowX + rightColSpanW - 3, summaryY + 4.6, { align: 'right' });
      } else {
        // Tax summary rows
        doc.setFillColor(255, 255, 255);
        doc.rect(rowX, summaryY, rightColSpanW, gstRowH, 'F');
        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.rect(rowX, summaryY, rightColSpanW, gstRowH, 'S');

        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.setFontSize(8);
        doc.setFont(activeFont, 'normal');
        doc.text(sRow.label, rowX + 3.5, summaryY + 4.5);
        doc.setFont(activeFont, 'bold');
        doc.text(sRow.value, rowX + rightColSpanW - 3, summaryY + 4.5, { align: 'right' });
      }

      summaryY += gstRowH;
    });

    y += totalGstSummaryH + 8;
  } else {
    // --- REGULAR BILL (SINGLE TOTAL ROW) ---
    const totalRowHeight = 8;
    const leftColSpanW = cols[0].width + cols[1].width + cols[2].width; // 126mm
    const qtyColW = cols[3].width; // 24mm
    const amountColW = cols[4].width; // 32mm

    // Left side: white background with border
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, leftColSpanW, totalRowHeight, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, leftColSpanW, totalRowHeight, 'S');

    if (notesParts.length > 0) {
      doc.setFont(activeFont, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(notesParts.join('   |   '), margin + 3, y + 5.3);
    }

    // Right side: solid red background for Total & Amount
    const totalX = margin + leftColSpanW;
    doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
    doc.rect(totalX, y, qtyColW + amountColW, totalRowHeight, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(totalX, y, qtyColW + amountColW, totalRowHeight, 'S');

    // Total label (centered in quantity column)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont(activeFont, 'bold');
    doc.text('Total', totalX + qtyColW / 2, y + 5.3, { align: 'center' });

    // Total amount (right-aligned in amount column)
    const totalStr = `₹${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    doc.text(totalStr, totalX + qtyColW + amountColW - 3, y + 5.3, { align: 'right' });

    y += totalRowHeight + 10;
  }

  // ==========================================================
  // 5. AUTHORIZED SIGNATURE (Natural spacing, Right Aligned)
  // For SRI SS GAS AGENCY
  // [Handwritten Authorized Signature]
  // Authorized Signatory
  // ==========================================================
  const sigBlockW = 55;
  const sigX = pageWidth - margin - sigBlockW;

  doc.setFontSize(8);
  doc.setFont(activeFont, 'normal');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('For ', sigX + sigBlockW / 2 - 16, y);
  doc.setFont(activeFont, 'bold');
  doc.text('SRI SS GAS AGENCY', sigX + sigBlockW / 2 - 10, y);

  y += 2;

  if (sigB64) {
    const sigImgW = 36;
    const sigImgH = 16;
    const imgX = sigX + (sigBlockW - sigImgW) / 2;
    doc.addImage(sigB64, 'PNG', imgX, y, sigImgW, sigImgH);
    y += sigImgH + 1;
  } else {
    y += 14;
  }

  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.line(sigX + 2, y, sigX + sigBlockW - 2, y);

  y += 3.5;

  doc.setFontSize(7.5);
  doc.setFont(activeFont, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Authorized Signatory', sigX + sigBlockW / 2, y, { align: 'center' });

  // Save / Download PDF
  const safeInvNo = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCustName = invoice.customerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeInvNo}_${safeCustName}.pdf`;
  doc.save(filename);

  try {
    await logAudit('Invoice PDF Exported', 'invoices', undefined, {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      grandTotal: invoice.grandTotal,
    });
  } catch {
    // Non-blocking if audit service / auth is offline or unconfigured
  }
}


