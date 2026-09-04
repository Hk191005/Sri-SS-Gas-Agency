import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { SupplierPurchase, CylinderType } from '../types/database.types';

export interface SupplierExportFilterInfo {
  search?: string;
  status?: string;
}

/**
 * Format local timestamp: DD-MM-YYYY HH:mm
 */
export function formatExportTimestamp(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
}

/**
 * Escape CSV field
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger browser file download
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 1. EXCEL EXPORT (Genuine OOXML .xlsx Multi-Sheet Workbook)
// -------------------------------------------------------------
export function exportSupplierPurchasesExcel(
  purchases: SupplierPurchase[],
  cylinderTypes: CylinderType[],
  _filters?: SupplierExportFilterInfo
): void {
  if (!purchases || purchases.length === 0) {
    throw new Error('No supplier purchases available to export.');
  }

  const exportDateStr = new Date().toISOString().split('T')[0];

  // 1. Sheet 1: Purchase Summary
  const summaryData = purchases.map((p) => {
    const itemsSummary = (p.items || [])
      .map((it) => {
        const ct = cylinderTypes.find((c) => c.id === it.cylinder_type_id);
        return `${it.quantity}x ${ct?.name || 'Cylinder'} @ Rs.${it.unit_price}`;
      })
      .join('; ');

    return {
      'Purchase Code': p.purchase_code,
      'Supplier Name': p.supplier_name,
      'Invoice Number': p.invoice_number,
      'Invoice Date': p.invoice_date,
      'Source': (p.purchase_source || 'manual').toUpperCase(),
      'Status': (p.status || 'confirmed').toUpperCase(),
      'Subtotal (INR)': Number(p.subtotal || 0),
      'GST / Tax (INR)': Number(p.tax_amount || 0),
      'Total Amount (INR)': Number(p.total_amount || 0),
      'Amount Paid (INR)': Number(p.amount_paid || 0),
      'Outstanding (INR)': Number(p.outstanding_amount || 0),
      'Cylinder Items Summary': itemsSummary,
      'Notes': p.notes || '',
      'Created At': p.created_at || '',
    };
  });

  // 2. Sheet 2: Purchase Line Items
  const itemsData: any[] = [];
  purchases.forEach((p) => {
    (p.items || []).forEach((it) => {
      const ct = cylinderTypes.find((c) => c.id === it.cylinder_type_id);
      itemsData.push({
        'Purchase Code': p.purchase_code,
        'Supplier Name': p.supplier_name,
        'Invoice Number': p.invoice_number,
        'Invoice Date': p.invoice_date,
        'Cylinder Type': ct?.name || 'Cylinder',
        'Quantity': it.quantity,
        'Unit Buying Price (INR)': Number(it.unit_price), // CRITICAL: EXACT HISTORICAL SNAPSHOT
        'Line Tax (INR)': Number(it.tax_amount || 0),
        'Line Total (INR)': Number(it.total_price || it.quantity * it.unit_price),
      });
    });
  });

  // 3. Sheet 3: Supplier Payments
  const paymentsData: any[] = [];
  purchases.forEach((p) => {
    (p.payments || []).forEach((py) => {
      paymentsData.push({
        'Purchase Code': p.purchase_code,
        'Supplier Name': p.supplier_name,
        'Invoice Number': p.invoice_number,
        'Payment Date': py.payment_date,
        'Payment Method': py.payment_method.toUpperCase(),
        'Amount Paid (INR)': Number(py.amount),
        'Notes / Reference': py.notes || '',
      });
    });
  });

  // Build Workbook
  const workbook = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsItems = XLSX.utils.json_to_sheet(itemsData.length > 0 ? itemsData : [{ 'Notice': 'No line items recorded' }]);
  const wsPayments = XLSX.utils.json_to_sheet(paymentsData.length > 0 ? paymentsData : [{ 'Notice': 'No payments recorded' }]);

  // Set column widths for optimal legibility
  wsSummary['!cols'] = [
    { wch: 15 }, // Purchase Code
    { wch: 25 }, // Supplier Name
    { wch: 16 }, // Invoice Number
    { wch: 14 }, // Invoice Date
    { wch: 14 }, // Source
    { wch: 14 }, // Status
    { wch: 15 }, // Subtotal
    { wch: 14 }, // Tax
    { wch: 16 }, // Total
    { wch: 16 }, // Paid
    { wch: 16 }, // Outstanding
    { wch: 40 }, // Cylinder Items Summary
    { wch: 30 }, // Notes
    { wch: 22 }, // Created At
  ];

  wsItems['!cols'] = [
    { wch: 15 }, // Purchase Code
    { wch: 25 }, // Supplier Name
    { wch: 16 }, // Invoice Number
    { wch: 14 }, // Invoice Date
    { wch: 20 }, // Cylinder Type
    { wch: 12 }, // Quantity
    { wch: 22 }, // Unit Buying Price
    { wch: 14 }, // Line Tax
    { wch: 16 }, // Line Total
  ];

  wsPayments['!cols'] = [
    { wch: 15 }, // Purchase Code
    { wch: 25 }, // Supplier Name
    { wch: 16 }, // Invoice Number
    { wch: 14 }, // Payment Date
    { wch: 18 }, // Payment Method
    { wch: 18 }, // Amount Paid
    { wch: 30 }, // Notes / Reference
  ];

  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Purchase Summary');
  XLSX.utils.book_append_sheet(workbook, wsItems, 'Purchase Items');
  XLSX.utils.book_append_sheet(workbook, wsPayments, 'Supplier Payments');

  // Generate genuine OOXML binary workbook
  XLSX.writeFile(workbook, `SRI_SS_GAS_Supplier_Purchases_${exportDateStr}.xlsx`, { bookType: 'xlsx' });
}

// -------------------------------------------------------------
// 2. CSV EXPORT (Detailed Line-Item & Financial Ledger)
// -------------------------------------------------------------
export function exportSupplierPurchasesCsv(
  purchases: SupplierPurchase[],
  cylinderTypes: CylinderType[],
  _filters?: SupplierExportFilterInfo
): void {
  if (!purchases || purchases.length === 0) {
    throw new Error('No supplier purchases available to export.');
  }

  const exportDateStr = new Date().toISOString().split('T')[0];
  const headers = [
    'Purchase Code',
    'Supplier Name',
    'Invoice Number',
    'Invoice Date',
    'Source',
    'Status',
    'Cylinder Type',
    'Quantity',
    'Unit Buying Price (INR)',
    'Line Total (INR)',
    'Invoice Subtotal (INR)',
    'Tax Amount (INR)',
    'Total Amount (INR)',
    'Amount Paid (INR)',
    'Outstanding Amount (INR)',
    'Notes',
    'Created At',
  ];

  const rows: string[][] = [];

  purchases.forEach((p) => {
    if (p.items && p.items.length > 0) {
      p.items.forEach((it) => {
        const ct = cylinderTypes.find((c) => c.id === it.cylinder_type_id);
        rows.push([
          p.purchase_code,
          p.supplier_name,
          p.invoice_number,
          p.invoice_date,
          (p.purchase_source || 'manual').toUpperCase(),
          (p.status || 'confirmed').toUpperCase(),
          ct?.name || 'Cylinder',
          String(it.quantity),
          Number(it.unit_price).toFixed(2),
          Number(it.total_price || it.quantity * it.unit_price).toFixed(2),
          Number(p.subtotal).toFixed(2),
          Number(p.tax_amount || 0).toFixed(2),
          Number(p.total_amount).toFixed(2),
          Number(p.amount_paid || 0).toFixed(2),
          Number(p.outstanding_amount || 0).toFixed(2),
          p.notes || '',
          p.created_at || '',
        ]);
      });
    } else {
      rows.push([
        p.purchase_code,
        p.supplier_name,
        p.invoice_number,
        p.invoice_date,
        (p.purchase_source || 'manual').toUpperCase(),
        (p.status || 'confirmed').toUpperCase(),
        'N/A',
        '0',
        '0.00',
        '0.00',
        Number(p.subtotal).toFixed(2),
        Number(p.tax_amount || 0).toFixed(2),
        Number(p.total_amount).toFixed(2),
        Number(p.amount_paid || 0).toFixed(2),
        Number(p.outstanding_amount || 0).toFixed(2),
        p.notes || '',
        p.created_at || '',
      ]);
    }
  });

  const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `SRI_SS_GAS_Supplier_Purchases_${exportDateStr}.csv`);
}

// -------------------------------------------------------------
// 3. PDF EXPORT (jsPDF Formatted Statement)
// -------------------------------------------------------------
export function exportSupplierPurchasesPdf(
  purchases: SupplierPurchase[],
  cylinderTypes: CylinderType[],
  filters?: SupplierExportFilterInfo
): void {
  if (!purchases || purchases.length === 0) {
    throw new Error('No supplier purchases available to export.');
  }

  const exportDateStr = new Date().toISOString().split('T')[0];
  const timestampStr = formatExportTimestamp();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryRed = [227, 27, 35]; // #E31B23
  const darkGray = [23, 23, 23];
  const medGray = [115, 115, 115];
  const lightBg = [250, 250, 250];
  const borderGray = [229, 229, 229];

  // 1. Header Banner
  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.rect(margin, y, contentWidth, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SRI SS GAS AGENCY', margin + 6, y + 7.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tiruppur District, Tamil Nadu · Supplier Purchase & Stock Intake Ledger', margin + 6, y + 13.5);

  doc.setFont('helvetica', 'bold');
  doc.text(`DATE: ${exportDateStr}`, pageWidth - margin - 6, y + 10.5, { align: 'right' });
  y += 24;

  // 2. Metadata / Filter Bar
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(medGray[0], medGray[1], medGray[2]);
  const filterSummary = `Exported on: ${timestampStr} | Status: ${filters?.status || 'All'} | Search: ${filters?.search ? `"${filters.search}"` : 'None'}`;
  doc.text(filterSummary, margin, y);
  y += 6;

  // 3. Financial Summary KPI Cards (4 cards)
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const totalOutstanding = purchases.reduce((sum, p) => sum + Number(p.outstanding_amount || 0), 0);

  const cardWidth = (contentWidth - 9) / 4;
  const cards = [
    { label: 'Total Invoices', value: `${purchases.length} Records`, color: darkGray },
    { label: 'Stock Purchases', value: `₹${totalPurchases.toLocaleString('en-IN')}`, color: darkGray },
    { label: 'Payments Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: [22, 163, 74] }, // Green
    { label: 'Total Outstanding', value: `₹${totalOutstanding.toLocaleString('en-IN')}`, color: [220, 38, 38] }, // Red
  ];

  cards.forEach((card, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(cardX, y, cardWidth, 16, 1.5, 1.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(card.label.toUpperCase(), cardX + 3, y + 5.5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, cardX + 3, y + 12);
  });
  y += 22;

  // 4. Table Header
  const renderTableHeader = (currentY: number) => {
    doc.setFillColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');

    doc.text('CODE', margin + 3, currentY + 4.8);
    doc.text('SUPPLIER / INVOICE', margin + 26, currentY + 4.8);
    doc.text('DATE', margin + 74, currentY + 4.8);
    doc.text('ITEMS (QTY × RATE)', margin + 96, currentY + 4.8);
    doc.text('TOTAL', margin + 144, currentY + 4.8, { align: 'right' });
    doc.text('PAID', margin + 162, currentY + 4.8, { align: 'right' });
    doc.text('DUE', pageWidth - margin - 3, currentY + 4.8, { align: 'right' });
  };

  renderTableHeader(y);
  y += 7;

  // 5. Table Rows
  purchases.forEach((p, index) => {
    // Check page overflow
    if (y + 14 > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      renderTableHeader(y);
      y += 7;
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(margin, y, contentWidth, 12, 'F');
    }

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, y + 12, pageWidth - margin, y + 12);

    // Code
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(p.purchase_code, margin + 3, y + 5);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text((p.purchase_source || 'manual').toUpperCase(), margin + 3, y + 9.5);

    // Supplier & Invoice
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const cleanSupplier = p.supplier_name.length > 22 ? p.supplier_name.slice(0, 20) + '...' : p.supplier_name;
    doc.text(cleanSupplier, margin + 26, y + 5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(`Inv #${p.invoice_number}`, margin + 26, y + 9.5);

    // Date
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(p.invoice_date, margin + 74, y + 7.5);

    // Items summary
    const itemsText = (p.items || [])
      .map((it) => {
        const ct = cylinderTypes.find((c) => c.id === it.cylinder_type_id);
        const name = ct ? ct.name.replace(' Commercial', '').replace(' Domestic', '').replace(' Industrial', '') : 'Cyl';
        return `${it.quantity}x ${name} @ Rs.${it.unit_price}`;
      })
      .join(', ');
    const splitItems = doc.splitTextToSize(itemsText || 'None', 44);
    doc.text(splitItems, margin + 96, y + 5.5);

    // Total
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs.${Number(p.total_amount).toLocaleString('en-IN')}`, margin + 144, y + 7.5, { align: 'right' });

    // Paid
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(7);
    doc.text(`Rs.${Number(p.amount_paid || 0).toLocaleString('en-IN')}`, margin + 162, y + 7.5, { align: 'right' });

    // Due
    doc.setTextColor(Number(p.outstanding_amount || 0) > 0 ? 220 : darkGray[0], Number(p.outstanding_amount || 0) > 0 ? 38 : darkGray[1], Number(p.outstanding_amount || 0) > 0 ? 38 : darkGray[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs.${Number(p.outstanding_amount || 0).toLocaleString('en-IN')}`, pageWidth - margin - 3, y + 7.5, { align: 'right' });

    y += 12;
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(
      `SRI SS GAS AGENCY · Confidential Internal Financial Statement · Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  doc.save(`SRI_SS_GAS_Supplier_Purchases_${exportDateStr}.pdf`);
}
