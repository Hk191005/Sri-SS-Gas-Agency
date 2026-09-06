/**
 * SRI SS GAS AGENCY — Professional Purchase / Sales Report PDF Generator
 * Generates print-ready, accounting-grade A4 PDF reports for gas cylinder purchases and sales.
 */

import { jsPDF } from 'jspdf';
import type { Purchase, Customer } from '../types/database.types';
import { logAudit } from './db';

export interface PurchaseReportOptions {
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  generatedBy?: string;
  customerMap?: Record<string, Customer>;
}

export async function exportPurchaseReportPdf(
  purchases: Purchase[],
  options: PurchaseReportOptions
): Promise<void> {
  const { periodLabel, generatedBy = 'SRI SS Admin', customerMap = {} } = options;

  // Use Landscape A4 for wide table columns without clipping
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 269mm
  let y = margin;

  // Branding Colors
  const primaryRed = [227, 27, 35]; // #E31B23
  const darkGray = [23, 23, 23]; // #171717
  const medGray = [115, 115, 115]; // #737373
  const lightBg = [250, 250, 250]; // #FAFAFA
  const borderGray = [229, 229, 229]; // #E5E5E5
  const tableHeaderBg = [244, 244, 245]; // #F4F4F5

  // 1. Calculate Summary Metrics
  const totalPurchases = purchases.length;
  const totalPurchaseValue = purchases.reduce((sum, p) => sum + (Number(p.total_gas_amount) || 0), 0);
  
  const uniqueCustomerIds = new Set<string>();
  purchases.forEach((p) => {
    if (p.customer_id) uniqueCustomerIds.add(p.customer_id);
  });
  const totalCustomers = uniqueCustomerIds.size;
  const avgPurchaseValue = totalPurchases > 0 ? Math.round(totalPurchaseValue / totalPurchases) : 0;

  // Helper: Draw Header & Summary (Top of Page 1)
  const drawDocumentHeader = () => {
    // Top Color Accent Bar
    doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.rect(margin, y, contentWidth, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('SRI SS GAS AGENCY', margin + 6, y + 8.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Tiruppur District, Tamil Nadu · Official Cylinder Sales & Purchase Register', margin + 6, y + 14.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE & SALES REPORT', pageWidth - margin - 6, y + 8.5, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const genTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    doc.text(`Period: ${periodLabel.toUpperCase()}  |  Generated: ${genTimestamp}`, pageWidth - margin - 6, y + 14.5, { align: 'right' });

    y += 24;

    // 2. Summary KPI Cards (4 columns)
    const cardWidth = (contentWidth - 9) / 4;
    const cards = [
      { label: 'Total Purchases', value: totalPurchases.toLocaleString('en-IN'), sub: 'Completed orders', color: darkGray },
      { label: 'Total Purchase Value', value: `₹${totalPurchaseValue.toLocaleString('en-IN')}`, sub: 'Gross sales revenue', color: primaryRed },
      { label: 'Active Customers', value: totalCustomers.toLocaleString('en-IN'), sub: 'Unique buyers', color: [79, 70, 229] }, // Indigo
      { label: 'Average Purchase Value', value: `₹${avgPurchaseValue.toLocaleString('en-IN')}`, sub: 'Per transaction', color: [22, 163, 74] }, // Green
    ];

    cards.forEach((card, idx) => {
      const cardX = margin + idx * (cardWidth + 3);
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.roundedRect(cardX, y, cardWidth, 18, 1.5, 1.5, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(medGray[0], medGray[1], medGray[2]);
      doc.text(card.label.toUpperCase(), cardX + 4, y + 5.5);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.text(card.value, cardX + 4, y + 12);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(medGray[0], medGray[1], medGray[2]);
      doc.text(card.sub, cardX + 4, y + 16);
    });

    y += 22;
  };

  // Helper: Draw Table Header
  const drawTableHeader = (currentY: number) => {
    doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, currentY, contentWidth, 7, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    // Column X offsets
    doc.text('#', margin + 3, currentY + 4.8);
    doc.text('Purchase Code', margin + 12, currentY + 4.8);
    doc.text('Date', margin + 45, currentY + 4.8);
    doc.text('Customer Name', margin + 78, currentY + 4.8);
    doc.text('Items / Particulars', margin + 145, currentY + 4.8);
    doc.text('Notes / Delivery', margin + 205, currentY + 4.8);
    doc.text('Total Amount', pageWidth - margin - 4, currentY + 4.8, { align: 'right' });

    return currentY + 7;
  };

  // Helper: Draw Footer on Every Page
  const drawPageFooter = (pageNum: number, totalPagesPlaceholder: string) => {
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(
      'CONFIDENTIAL — SRI SS GAS AGENCY · Official Business Purchase & Sales Dossier',
      margin,
      pageHeight - 6.5
    );

    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${pageNum} of ${totalPagesPlaceholder} · Generated by ${generatedBy}`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  };

  // Draw Page 1 Header
  drawDocumentHeader();
  y = drawTableHeader(y);

  if (purchases.length === 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text('No purchase transactions recorded for the selected date period.', margin + 4, y + 8);
    y += 14;
  } else {
    const rowHeight = 6.5;
    const pageBottomLimit = pageHeight - 16;

    purchases.forEach((p, idx) => {
      // Check if new page is needed
      if (y + rowHeight > pageBottomLimit) {
        doc.addPage();
        y = margin;
        // Draw top small header on continuation pages
        doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
        doc.rect(margin, y, contentWidth, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('SRI SS GAS AGENCY — PURCHASE REPORT (CONTINUED)', margin + 4, y + 4.8);
        doc.text(`Period: ${periodLabel.toUpperCase()}`, pageWidth - margin - 4, y + 4.8, { align: 'right' });
        y += 9;
        y = drawTableHeader(y);
      }

      // Alternate row background
      if (idx % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      // Resolve Customer Name (Never show raw UUID)
      let customerName = 'Unknown Customer';
      if (p.customer && p.customer.name) {
        customerName = p.customer.name + (p.customer.company_name ? ` (${p.customer.company_name})` : '');
      } else if (p.customer_id && customerMap[p.customer_id]) {
        const c = customerMap[p.customer_id];
        customerName = c.name + (c.company_name ? ` (${c.company_name})` : '');
      }

      // Format Purchase Date
      let formattedDate = p.purchase_date;
      try {
        const d = new Date(p.purchase_date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch (e) {
        // fallback to raw
      }

      // Format Items Description
      let itemsSummary = 'Gas Cylinder Refill';
      if (p.items && p.items.length > 0) {
        itemsSummary = p.items
          .map((it) => {
            const typeName = typeof it.cylinder_type === 'object' && it.cylinder_type ? (it.cylinder_type as any).name : 'Cylinder';
            return `${typeName} × ${it.quantity}`;
          })
          .join(', ');
      }

      // Row Border Bottom
      doc.setDrawColor(240, 240, 240);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      // Render Cells
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(medGray[0], medGray[1], medGray[2]);
      doc.text(String(idx + 1), margin + 3, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
      doc.text(p.purchase_code, margin + 12, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(formattedDate, margin + 45, y + 4.5);

      doc.setFont('helvetica', 'bold');
      const truncatedName = doc.splitTextToSize(customerName, 63)[0] || customerName;
      doc.text(truncatedName, margin + 78, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(medGray[0], medGray[1], medGray[2]);
      const truncatedItems = doc.splitTextToSize(itemsSummary, 56)[0] || itemsSummary;
      doc.text(truncatedItems, margin + 145, y + 4.5);

      const notesText = (p.notes || '-').trim();
      const truncatedNotes = doc.splitTextToSize(notesText, 45)[0] || notesText;
      doc.text(truncatedNotes, margin + 205, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`₹${(p.total_gas_amount || 0).toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 4.5, { align: 'right' });

      y += rowHeight;
    });

    // Grand Total Row
    if (y + 8 > pageHeight - 16) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, 7, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(`TOTAL (${totalPurchases} PURCHASES)`, margin + 12, y + 4.8);

    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text(`₹${totalPurchaseValue.toLocaleString('en-IN')}`, pageWidth - margin - 4, y + 4.8, { align: 'right' });
  }

  // Add Page Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, String(totalPages));
  }

  // Audit Logging
  try {
    await logAudit('Purchase Report PDF Exported', 'reports', undefined, {
      period: periodLabel,
      total_purchases: totalPurchases,
      total_value: totalPurchaseValue,
    });
  } catch (e) {
    // Non-blocking
  }

  // Save File
  const dateSlug = new Date().toISOString().split('T')[0];
  const filename = `SRI_SS_GAS_Purchase_Report_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${dateSlug}.pdf`;
  doc.save(filename);
}
