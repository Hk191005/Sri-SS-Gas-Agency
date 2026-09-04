/**
 * SRI SS GAS AGENCY — Customer PDF Export Engine
 * Generates secure, confidential client-side PDF account statements.
 */

import { jsPDF } from 'jspdf';
import type { Customer, Purchase, Payment, Deposit } from '../types/database.types';
import { logAudit } from './db';

export async function exportCustomerProfilePdf(
  customer: Customer,
  purchases: Purchase[] = [],
  payments: Payment[] = [],
  deposits: Deposit[] = []
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryRed = [227, 27, 35]; // SUPERGAS red #E31B23
  const darkGray = [23, 23, 23];
  const medGray = [115, 115, 115];
  const lightBg = [250, 250, 250];
  const borderGray = [229, 229, 229];

  // 1. Header Banner
  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.rect(margin, y, contentWidth, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SRI SS GAS AGENCY', margin + 6, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tiruppur District, Tamil Nadu · Official Customer Account Dossier', margin + 6, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text(`CODE: ${customer.customer_code}`, pageWidth - margin - 6, y + 11, { align: 'right' });
  y += 24;

  // 2. Customer Profile Details Box
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');

  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name, margin + 5, y + 8);

  if (customer.company_name) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(`Company: ${customer.company_name}`, margin + 5, y + 14);
  }

  doc.setFontSize(8.5);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin + 5, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.customer_type.toUpperCase(), margin + 20, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('Phone:', margin + 5, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.phone + (customer.alternate_phone ? ` / ${customer.alternate_phone}` : ''), margin + 20, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.text('Status:', margin + 5, y + 34);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.is_active ? 'ACTIVE ACCOUNT' : 'INACTIVE / ARCHIVED', margin + 20, y + 34);

  // Address (Right column)
  const addrX = margin + contentWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Registered Address:', addrX, y + 8);
  doc.setFont('helvetica', 'normal');
  const addressParts = [
    customer.street,
    customer.area1,
    customer.area2,
    customer.landmark,
    customer.city || 'Tiruppur',
    customer.district || 'Tiruppur',
    customer.pincode,
  ].filter(Boolean);
  const addressText = addressParts.join(', ') || 'Tiruppur, Tamil Nadu';
  const splitAddress = doc.splitTextToSize(addressText, contentWidth / 2 - 8);
  doc.text(splitAddress, addrX, y + 14);

  y += 44;

  // 3. Segregated Financial Ledger Summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.text('FINANCIAL LEDGER & DEPOSIT SUMMARY', margin, y);
  y += 4;

  const totalGasPurchased = purchases.reduce((sum, p) => sum + p.total_gas_amount, 0);
  const totalPaid = payments.reduce((sum, py) => sum + py.amount, 0);
  const outstandingBalance = Math.max(0, totalGasPurchased - totalPaid);
  const heldDeposits = deposits
    .filter((d) => d.status === 'given' || d.status === 'held')
    .reduce((sum, d) => sum + d.amount, 0);

  const cardWidth = (contentWidth - 9) / 4;
  const cards = [
    { label: 'Total Gas Purchased', value: `₹${totalGasPurchased.toLocaleString('en-IN')}`, color: darkGray },
    { label: 'Total Gas Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: [22, 163, 74] }, // Green
    { label: 'Outstanding Balance', value: `₹${outstandingBalance.toLocaleString('en-IN')}`, color: [220, 38, 38] }, // Red
    { label: 'Security Deposits Held', value: `₹${heldDeposits.toLocaleString('en-IN')}`, color: [79, 70, 229] }, // Indigo
  ];

  cards.forEach((card, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(cardX, y, cardWidth, 18, 1.5, 1.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text(card.label.toUpperCase(), cardX + 3, y + 6);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, cardX + 3, y + 13);
  });
  y += 24;

  // 4. Purchases History Table
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text(`Gas Refill Orders (${purchases.length})`, margin, y);
  y += 4;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Code', margin + 3, y + 4.2);
  doc.text('Date', margin + 35, y + 4.2);
  doc.text('Notes / Delivery Details', margin + 65, y + 4.2);
  doc.text('Gas Amount', pageWidth - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  if (purchases.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text('No historical gas purchase transactions recorded.', margin + 3, y + 5);
    y += 8;
  } else {
    purchases.slice(0, 10).forEach((p) => {
      doc.setFontSize(7.5);
      doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(p.purchase_code, margin + 3, y + 4.5);

      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(p.purchase_date, margin + 35, y + 4.5);
      doc.text(p.notes || 'Gas cylinder refill delivery', margin + 65, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.text(`₹${p.total_gas_amount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y + 4.5, { align: 'right' });
      y += 6;
    });
  }
  y += 4;

  // 5. Payment Receipts Table
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text(`Payment Receipts (${payments.length})`, margin, y);
  y += 4;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt ID', margin + 3, y + 4.2);
  doc.text('Date', margin + 35, y + 4.2);
  doc.text('Method', margin + 65, y + 4.2);
  doc.text('Amount Paid', pageWidth - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  if (payments.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(medGray[0], medGray[1], medGray[2]);
    doc.text('No payment receipts recorded.', margin + 3, y + 5);
    y += 8;
  } else {
    payments.slice(0, 8).forEach((py) => {
      doc.setFontSize(7.5);
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text(`RCP-${(py.id || '').slice(0, 8).toUpperCase()}`, margin + 3, y + 4.5);

      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(py.payment_date, margin + 35, y + 4.5);
      doc.text(py.payment_method.toUpperCase(), margin + 65, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.text(`₹${py.amount.toLocaleString('en-IN')}`, pageWidth - margin - 3, y + 4.5, { align: 'right' });
      y += 6;
    });
  }

  // 6. Security Footer / Watermark
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(medGray[0], medGray[1], medGray[2]);
  doc.text(
    `CONFIDENTIAL — SRI SS GAS AGENCY · Customer Code: ${customer.customer_code}`,
    margin,
    pageHeight - 9
  );

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${timestamp} · Authorized Admin Export`, pageWidth - margin, pageHeight - 9, {
    align: 'right',
  });

  // Log Audit
  await logAudit('Customer PDF Exported', 'customers', customer.id, {
    customer_code: customer.customer_code,
    name: customer.name,
  });

  // Trigger Save
  const fileName = `SSG_Customer_${customer.customer_code}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
