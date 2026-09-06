/**
 * SRI SS GAS AGENCY — Customer Invoice & GST Bill PDF Generator
 * Generates official, print-ready A4 Portrait Tax Invoices and Regular Bills.
 * The seller is ALWAYS Sri SS Gas Agency.
 */

import { jsPDF } from 'jspdf';
import { logAudit } from './db';

export interface InvoiceLineItem {
  description: string;
  cylinder_type_id?: string;
  hsn: string;
  quantity: number;
  rate: number;
  taxableAmount: number;
  gstRate: number; // percentage, e.g. 5, 18
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface InvoiceData {
  invoiceType: 'regular' | 'gst';
  invoiceNumber: string;
  invoiceDate: string;
  supplyDate?: string;
  vehicleNumber?: string;

  // Seller Details (Sri SS Gas Agency)
  agencyName: string;
  agencyAddress: string;
  agencyPhone: string;
  agencyEmail: string;
  agencyGstin?: string;
  agencyState: string;
  agencyStateCode: string;

  // Buyer / Customer Details
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerStateCode?: string;
  customerGstin?: string;

  // Items
  items: InvoiceLineItem[];

  // Financials
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;

  notes?: string;
  paymentMode?: string;
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

  // Colors
  const primaryRed = [227, 27, 35]; // #E31B23
  const darkGray = [23, 23, 23]; // #171717
  const medGray = [115, 115, 115]; // #737373
  const lightBg = [250, 250, 250]; // #FAFAFA
  const borderGray = [229, 229, 229]; // #E5E5E5
  const tableHeaderBg = [244, 244, 245]; // #F4F4F5

  const isGST = invoice.invoiceType === 'gst';

  // 1. Top Header Banner
  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.agencyName.toUpperCase(), margin + 6, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const agencySub = `${invoice.agencyAddress} · Phone: ${invoice.agencyPhone} · Email: ${invoice.agencyEmail}`;
  doc.text(agencySub, margin + 6, y + 14);

  // Title on right (TAX INVOICE or REGULAR BILL)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const invoiceTitle = isGST ? 'TAX INVOICE' : 'RETAIL SALE BILL';
  doc.text(invoiceTitle, pageWidth - margin - 6, y + 9, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (isGST && invoice.agencyGstin) {
    doc.text(`GSTIN: ${invoice.agencyGstin}`, pageWidth - margin - 6, y + 15, { align: 'right' });
  } else {
    doc.text('ORIGINAL FOR RECIPIENT', pageWidth - margin - 6, y + 15, { align: 'right' });
  }

  y += 26;

  // 2. Metadata Box: Invoice Info (Left) and Customer Info (Right)
  const metaBoxHeight = 44;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, metaBoxHeight, 2, 2, 'FD');

  // Vertical divider inside box
  const halfX = margin + contentWidth / 2;
  doc.line(halfX, y, halfX, y + metaBoxHeight);

  // Left Column: Invoice Details
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS', margin + 4, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', margin + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceNumber, margin + 28, y + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Date:', margin + 4, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceDate, margin + 28, y + 19);

  if (isGST) {
    doc.setFont('helvetica', 'bold');
    doc.text('Date of Supply:', margin + 4, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.supplyDate || invoice.invoiceDate, margin + 28, y + 25);

    doc.setFont('helvetica', 'bold');
    doc.text('Place of Supply:', margin + 4, y + 31);
    doc.setFont('helvetica', 'normal');
    doc.text(`${invoice.customerState || 'Tamil Nadu'} (${invoice.customerStateCode || '33'})`, margin + 28, y + 31);

    if (invoice.vehicleNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('Vehicle No:', margin + 4, y + 37);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.vehicleNumber, margin + 28, y + 37);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Mode:', margin + 4, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text((invoice.paymentMode || 'Cash').toUpperCase(), margin + 28, y + 25);
  }

  // Right Column: Customer / Buyer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BILLED TO / BUYER', halfX + 4, y + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.customerName, halfX + 4, y + 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let custY = y + 18;
  if (invoice.customerCompany) {
    doc.text(invoice.customerCompany, halfX + 4, custY);
    custY += 5;
  }
  const fullAddress = [invoice.customerAddress, invoice.customerCity].filter(Boolean).join(', ');
  if (fullAddress) {
    doc.text(fullAddress, halfX + 4, custY, { maxWidth: contentWidth / 2 - 8 });
    custY += 5;
  }
  if (invoice.customerPhone) {
    doc.text(`Phone: ${invoice.customerPhone}`, halfX + 4, custY);
    custY += 5;
  }
  if (isGST && invoice.customerGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${invoice.customerGstin}`, halfX + 4, custY);
  }

  y += metaBoxHeight + 6;

  // 3. Line Items Table
  // Define columns based on Invoice Type
  interface ColDef {
    header: string;
    width: number;
    align: 'left' | 'right' | 'center';
  }

  let cols: ColDef[] = [];
  if (isGST) {
    // 7 columns: #, Description, HSN, Qty, Rate, Taxable, Tax, Total
    cols = [
      { header: '#', width: 8, align: 'center' },
      { header: 'Item Description', width: 56, align: 'left' },
      { header: 'HSN', width: 22, align: 'center' },
      { header: 'Qty', width: 14, align: 'center' },
      { header: 'Rate (₹)', width: 22, align: 'right' },
      { header: 'Taxable (₹)', width: 24, align: 'right' },
      { header: 'GST', width: 16, align: 'center' },
      { header: 'Total (₹)', width: 20, align: 'right' },
    ];
  } else {
    // Regular 5 columns: #, Description, Qty, Rate, Amount
    cols = [
      { header: '#', width: 10, align: 'center' },
      { header: 'Item Description', width: 88, align: 'left' },
      { header: 'Quantity', width: 24, align: 'center' },
      { header: 'Rate (₹)', width: 30, align: 'right' },
      { header: 'Amount (₹)', width: 30, align: 'right' },
    ];
  }

  // Draw Table Header
  const tableHeaderHeight = 7;
  doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, y, contentWidth, tableHeaderHeight, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

  let currentX = margin;
  cols.forEach((c) => {
    let textX = currentX + 2;
    if (c.align === 'center') textX = currentX + c.width / 2;
    if (c.align === 'right') textX = currentX + c.width - 2;
    doc.text(c.header, textX, y + 4.8, { align: c.align });
    currentX += c.width;
  });

  y += tableHeaderHeight;

  // Draw Item Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const rowHeight = 7.5;
  invoice.items.forEach((item, index) => {
    // Row background alternating
    if (index % 2 === 1) {
      doc.setFillColor(253, 253, 253);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    currentX = margin;
    if (isGST) {
      // 1. #
      doc.text(String(index + 1), currentX + cols[0].width / 2, y + 5, { align: 'center' });
      currentX += cols[0].width;

      // 2. Description
      doc.setFont('helvetica', 'bold');
      doc.text(item.description, currentX + 2, y + 5);
      doc.setFont('helvetica', 'normal');
      currentX += cols[1].width;

      // 3. HSN
      doc.text(item.hsn || '27111200', currentX + cols[2].width / 2, y + 5, { align: 'center' });
      currentX += cols[2].width;

      // 4. Qty
      doc.text(String(item.quantity), currentX + cols[3].width / 2, y + 5, { align: 'center' });
      currentX += cols[3].width;

      // 5. Rate
      doc.text(item.rate.toFixed(2), currentX + cols[4].width - 2, y + 5, { align: 'right' });
      currentX += cols[4].width;

      // 6. Taxable
      doc.text(item.taxableAmount.toFixed(2), currentX + cols[5].width - 2, y + 5, { align: 'right' });
      currentX += cols[5].width;

      // 7. GST %
      doc.text(`${item.gstRate}%`, currentX + cols[6].width / 2, y + 5, { align: 'center' });
      currentX += cols[6].width;

      // 8. Total
      doc.setFont('helvetica', 'bold');
      doc.text(item.total.toFixed(2), currentX + cols[7].width - 2, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    } else {
      // Regular
      doc.text(String(index + 1), currentX + cols[0].width / 2, y + 5, { align: 'center' });
      currentX += cols[0].width;

      doc.setFont('helvetica', 'bold');
      doc.text(item.description, currentX + 2, y + 5);
      doc.setFont('helvetica', 'normal');
      currentX += cols[1].width;

      doc.text(String(item.quantity), currentX + cols[2].width / 2, y + 5, { align: 'center' });
      currentX += cols[2].width;

      doc.text(item.rate.toFixed(2), currentX + cols[3].width - 2, y + 5, { align: 'right' });
      currentX += cols[3].width;

      doc.setFont('helvetica', 'bold');
      doc.text(item.total.toFixed(2), currentX + cols[4].width - 2, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += rowHeight;
  });

  y += 4;

  // 4. Summary & Totals Calculation Box
  const summaryHeight = isGST ? 48 : 34;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, summaryHeight, 2, 2, 'FD');

  // Left Note & Amount in Words
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.42;
  const rightX = margin + leftWidth;

  // Vertical line separating Left (Words/Notes) from Right (Math Totals)
  doc.line(rightX, y, rightX, y + summaryHeight);

  // Left side: Amount in Words
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(medGray[0], medGray[1], medGray[2]);
  doc.text('TOTAL AMOUNT IN WORDS:', margin + 4, y + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  const words = numberToWordsINR(invoice.grandTotal);
  doc.text(words, margin + 4, y + 12, { maxWidth: leftWidth - 8 });

  if (invoice.notes) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(`Notes: ${invoice.notes}`, margin + 4, y + 26, { maxWidth: leftWidth - 8 });
  }

  // Right side: Breakdown Calculations
  let mathY = y + 6;
  doc.setFontSize(8);

  if (isGST) {
    // Taxable Subtotal
    doc.setFont('helvetica', 'normal');
    doc.text('Taxable Amount:', rightX + 4, mathY);
    doc.text(`₹${invoice.taxableAmount.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
    mathY += 5;

    // CGST + SGST (Intra-state) or IGST (Inter-state)
    if (invoice.cgstAmount > 0 || invoice.sgstAmount > 0) {
      doc.text('CGST:', rightX + 4, mathY);
      doc.text(`₹${invoice.cgstAmount.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 4.5;

      doc.text('SGST:', rightX + 4, mathY);
      doc.text(`₹${invoice.sgstAmount.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 4.5;
    } else if (invoice.igstAmount > 0) {
      doc.text('IGST:', rightX + 4, mathY);
      doc.text(`₹${invoice.igstAmount.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 5;
    }

    if (invoice.roundOff !== 0) {
      doc.text('Round Off:', rightX + 4, mathY);
      doc.text(`${invoice.roundOff >= 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 5;
    }
  } else {
    // Regular Bill Subtotal & Discount
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', rightX + 4, mathY);
    doc.text(`₹${invoice.subtotal.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
    mathY += 5.5;

    if (invoice.discount > 0) {
      doc.text('Discount:', rightX + 4, mathY);
      doc.text(`- ₹${invoice.discount.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 5.5;
    }

    if (invoice.roundOff !== 0) {
      doc.text('Round Off:', rightX + 4, mathY);
      doc.text(`${invoice.roundOff >= 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}`, pageWidth - margin - 4, mathY, { align: 'right' });
      mathY += 5.5;
    }
  }

  // Grand Total Line
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(rightX, y + summaryHeight - 11, pageWidth - margin, y + summaryHeight - 11);

  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.rect(rightX, y + summaryHeight - 10, rightWidth, 10, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', rightX + 4, y + summaryHeight - 3.5);
  doc.text(`₹${invoice.grandTotal.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + summaryHeight - 3.5, { align: 'right' });

  y += summaryHeight + 10;

  // 5. Declarations, Terms and Signature Block
  const sigBoxHeight = 32;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, sigBoxHeight, 2, 2, 'FD');

  // Terms (Left)
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS:', margin + 4, y + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(medGray[0], medGray[1], medGray[2]);
  doc.text('1. Goods once sold will not be taken back or exchanged.', margin + 4, y + 11);
  doc.text('2. Cylinders remain the property of the agency and must be returned upon refill.', margin + 4, y + 15);
  doc.text('3. In case of any leakage/discrepancy, report within 24 hours of delivery.', margin + 4, y + 19);
  doc.text('4. Subject to Tiruppur jurisdiction only.', margin + 4, y + 23);

  // Authorized Signatory (Right)
  const sigX = pageWidth - margin - 50;
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`For ${invoice.agencyName}`, sigX, y + 6);

  doc.setDrawColor(medGray[0], medGray[1], medGray[2]);
  doc.line(sigX, y + 22, pageWidth - margin - 4, y + 22);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory', sigX, y + 26);

  // Save / Download PDF
  const filename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${invoice.customerName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(filename);

  await logAudit('Invoice PDF Exported', 'invoices', undefined, {
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    grandTotal: invoice.grandTotal,
    type: invoice.invoiceType,
  });
}
