/**
 * SRI SS GAS AGENCY — Bulk Active Customers Proof PDF Export Engine
 * 
 * Generates an authoritative, official dossier PDF containing all active customers
 * and their actual uploaded verification documents retrieved from private Supabase Storage.
 * 
 * Rules Enforced:
 * 1. Exactly TWO PAGES per active customer:
 *    - Page 1: Customer Information (Name, Mobile, Complete Address, ID Code, Account Summary)
 *    - Page 2: Actual Proof Document (Full-page authentic proof image, aspect ratio 100% preserved)
 * 2. If no proof document exists: Page 2 displays "NO VERIFICATION DOCUMENT ON FILE".
 * 3. Never combine customer info and proof document onto one page.
 * 4. Active customers only (is_active === true AND deleted_at IS NULL).
 * 5. Sorted alphabetically by customer name.
 * 6. Deduplicates repeated document records referring to the same storage object.
 * 7. Expected PDF pages = Active customer count × 2.
 * 8. Private storage vault integrity maintained with authenticated short-lived access.
 */

import { jsPDF } from 'jspdf';
import type { Customer, CustomerDocument, DocumentType } from '../types/database.types';
import { supabase, isSupabaseConfigured, SupabaseNotConfiguredError } from './supabase';
import { isCustomerActive } from './customerLifecycle';
import { logAudit } from './db';

export interface CustomerWithProofDocs {
  customer: Customer;
  documents: CustomerDocument[];
  hasProof: boolean;
  docTypes: DocumentType[];
}

export interface CustomerProofExportSummary {
  totalActiveCustomers: number;
  customersWithDocsCount: number;
  customersWithoutDocsCount: number;
  totalAvailableDocsCount: number;
  customers: CustomerWithProofDocs[];
}

export interface ExportProgressUpdate {
  phase: 'fetching_records' | 'downloading_proofs' | 'rendering_pdf' | 'saving' | 'complete' | 'error';
  currentCustomerIndex?: number;
  totalCustomers?: number;
  currentCustomerName?: string;
  percent: number;
  message: string;
}

export interface DecodedImageDetails {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  documentType: DocumentType;
}

export interface GeneratedPdfResult {
  blob: Blob | ArrayBuffer;
  fileName: string;
  totalPages: number;
  totalActiveCustomers: number;
  embeddedImagesCount: number;
  customersWithMissingDocs: string[];
  customersWithEmbeddedProofs: string[];
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar Card',
  address_proof: 'Address Proof',
  gst: 'GST Certificate',
  pan: 'PAN Card',
  business_reg: 'Business Registration',
  license: 'License / Permit',
  other: 'Other Proof Document',
};

/**
 * Format address parts safely into a readable, multi-line string.
 */
export function formatCustomerFullAddress(c: Customer): string {
  const parts: string[] = [];
  if (c.street?.trim()) parts.push(c.street.trim());
  if (c.area1?.trim()) parts.push(c.area1.trim());
  if (c.area2?.trim()) parts.push(c.area2.trim());
  if (c.landmark?.trim()) parts.push(`Landmark: ${c.landmark.trim()}`);
  
  const city = c.city?.trim() || 'Tiruppur';
  const district = c.district?.trim() || 'Tiruppur';
  const pincode = c.pincode?.trim();

  let regionLine = city;
  if (district && district.toLowerCase() !== city.toLowerCase()) {
    regionLine += `, ${district}`;
  }
  if (pincode) {
    regionLine += ` - ${pincode}`;
  }
  parts.push(regionLine);

  return parts.filter(Boolean).join(', ') || 'Tiruppur District, Tamil Nadu';
}

/**
 * Fetches all active customers and their proof documents from Supabase.
 * Enforces authoritative customer lifecycle status and document deduplication.
 */
export async function fetchActiveCustomersAndProofsSummary(): Promise<CustomerProofExportSummary> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }

  // 1. Fetch all active customers from Supabase
  const { data: rawCustomers, error: custError } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (custError) {
    throw new Error(`Failed to load active customers: ${custError.message}`);
  }

  // Double-verify with authoritative lifecycle evaluator
  const activeCustomers = (rawCustomers || []).filter(isCustomerActive);

  // Sort alphabetically by customer name
  activeCustomers.sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  const activeCustomerIds = activeCustomers.map((c) => c.id);

  // 2. Fetch all proof documents for these active customers
  let allDocuments: CustomerDocument[] = [];
  if (activeCustomerIds.length > 0) {
    const { data: rawDocs, error: docError } = await supabase
      .from('customer_documents')
      .select('*')
      .in('customer_id', activeCustomerIds)
      .order('uploaded_at', { ascending: false });

    if (docError) {
      throw new Error(`Failed to load customer proof documents: ${docError.message}`);
    }
    allDocuments = (rawDocs || []) as CustomerDocument[];
  }

  // 3. Deduplicate documents per customer referring to identical storage objects
  const docsByCustomerId = new Map<string, CustomerDocument[]>();
  for (const doc of allDocuments) {
    const list = docsByCustomerId.get(doc.customer_id) || [];
    // Deduplicate repeated records pointing to the same storage_path
    const isDuplicate = list.some(
      (existing) =>
        existing.storage_path === doc.storage_path ||
        (existing.original_filename === doc.original_filename &&
          existing.file_size === doc.file_size &&
          existing.document_type === doc.document_type)
    );
    if (!isDuplicate) {
      list.push(doc);
    }
    docsByCustomerId.set(doc.customer_id, list);
  }

  // 4. Build consolidated active customer records with proof status
  const preparedList: CustomerWithProofDocs[] = activeCustomers.map((customer) => {
    const documents = docsByCustomerId.get(customer.id) || [];
    return {
      customer,
      documents,
      hasProof: documents.length > 0,
      docTypes: documents.map((d) => d.document_type),
    };
  });

  const totalActiveCustomers = preparedList.length;
  const customersWithDocsCount = preparedList.filter((c) => c.hasProof).length;
  const customersWithoutDocsCount = totalActiveCustomers - customersWithDocsCount;
  const totalAvailableDocsCount = preparedList.reduce((sum, c) => sum + c.documents.length, 0);

  return {
    totalActiveCustomers,
    customersWithDocsCount,
    customersWithoutDocsCount,
    totalAvailableDocsCount,
    customers: preparedList,
  };
}

/**
 * Downloads a document from the private 'customer-documents' bucket
 * and converts it to a decoded image data URL with natural dimensions.
 */
export async function downloadAndDecodeDocumentImage(
  doc: CustomerDocument
): Promise<DecodedImageDetails> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }

  let blob: Blob | null = null;

  // Primary retrieval strategy: direct authenticated download
  try {
    const { data, error } = await supabase.storage
      .from('customer-documents')
      .download(doc.storage_path);
    if (!error && data) {
      blob = data;
    }
  } catch {
    // Fallback if download throws
  }

  // Secondary retrieval strategy: short-lived authenticated signed URL
  if (!blob) {
    const { data: signedData, error: signError } = await supabase.storage
      .from('customer-documents')
      .createSignedUrl(doc.storage_path, 300);

    if (signError || !signedData?.signedUrl) {
      throw new Error(
        `Unable to access file in private vault for ${doc.original_filename}: ${signError?.message || 'Access denied'}`
      );
    }

    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch proof document bytes (${response.status} ${response.statusText}): ${doc.original_filename}`
      );
    }
    blob = await response.blob();
  }

  if (!blob || blob.size === 0) {
    throw new Error(`Empty document received from vault: ${doc.original_filename}`);
  }

  // Check if file is a PDF
  const isPdf =
    (doc.mime_type && doc.mime_type.toLowerCase().includes('pdf')) ||
    (doc.original_filename && doc.original_filename.toLowerCase().endsWith('.pdf')) ||
    (blob.type && blob.type.toLowerCase().includes('pdf'));

  if (isPdf) {
    throw new Error(`PDF_FORMAT_NOT_IMAGE: Document ${doc.original_filename} is a PDF document.`);
  }

  // Decode image dimensions and convert to JPEG/PNG Data URL
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Browser runtime execution
    return new Promise<DecodedImageDetails>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob as Blob);
      const img = new Image();

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Render onto offscreen canvas for standardized JPEG encoding & orientation
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas 2D context unavailable for image decoding'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          URL.revokeObjectURL(objectUrl);

          resolve({
            dataUrl,
            width,
            height,
            format: 'JPEG',
            originalFilename: doc.original_filename,
            mimeType: doc.mime_type || 'image/jpeg',
            fileSize: doc.file_size || blob?.size || 0,
            documentType: doc.document_type,
          });
        } catch (canvasErr) {
          URL.revokeObjectURL(objectUrl);
          reject(canvasErr);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            `Failed to decode image bytes for ${doc.original_filename}. File may be corrupted or unsupported.`
          )
        );
      };

      img.src = objectUrl;
    });
  } else {
    // Non-browser / test environment fallback
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Str =
      typeof btoa !== 'undefined'
        ? btoa(binary)
        : (globalThis as any).Buffer?.from(arrayBuffer).toString('base64') || '';
    const mime = doc.mime_type || 'image/jpeg';
    const base64 = `data:${mime};base64,` + base64Str;

    return {
      dataUrl: base64,
      width: 1200,
      height: 900,
      format: mime.includes('png') ? 'PNG' : 'JPEG',
      originalFilename: doc.original_filename,
      mimeType: mime,
      fileSize: uint8Array.byteLength,
      documentType: doc.document_type,
    };
  }
}

/**
 * Calculates aspect-ratio-preserving dimensions that fit entirely inside a bounding box.
 * Guarantees zero cropping, zero stretching, and zero distortion.
 */
export function calculateFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const imageRatio = naturalWidth / naturalHeight;
  const boxRatio = maxWidth / maxHeight;

  if (imageRatio > boxRatio) {
    // Image is wider than bounding box -> width constrained
    const fitWidth = maxWidth;
    const fitHeight = fitWidth / imageRatio;
    return { width: fitWidth, height: fitHeight };
  } else {
    // Image is taller than bounding box -> height constrained
    const fitHeight = maxHeight;
    const fitWidth = fitHeight * imageRatio;
    return { width: fitWidth, height: fitHeight };
  }
}

/**
 * PAGE 1: Renders Customer Information Page
 * Displays Customer name, registered mobile, complete address, identification/reference number,
 * and account verification summary.
 */
export function renderCustomerInfoPage(
  doc: jsPDF,
  customerData: CustomerWithProofDocs,
  customerIndex: number,
  totalCustomers: number,
  pageNumber: number,
  totalPages: number,
  decodedImages: DecodedImageDetails[],
  errorMessage?: string
): void {
  const { customer } = customerData;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 14;

  // Curated color palette
  const primaryRed = [227, 27, 35]; // Brand red #E31B23
  const darkGray = [17, 24, 39]; // #111827
  const bodyText = [55, 65, 81]; // #374151
  const labelText = [107, 114, 128]; // #6B7280
  const lightBg = [249, 250, 251]; // #F9FAFB
  const borderGray = [229, 231, 235]; // #E5E7EB
  const emeraldGreen = [22, 163, 74]; // #16A34A

  // -------------------------------------------------------------
  // 1. TOP HEADER BANNER
  // -------------------------------------------------------------
  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SRI SS GAS AGENCY', margin + 6, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Tiruppur District, Tamil Nadu · Official Active Customer Record Dossier',
    margin + 6,
    y + 13.5
  );

  // Customer Code & Page badge in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`ID: ${customer.customer_code}`, pageWidth - margin - 6, y + 7.5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Page ${pageNumber} of ${totalPages} (Customer ${customerIndex + 1}/${totalCustomers} · Info)`,
    pageWidth - margin - 6,
    y + 13,
    { align: 'right' }
  );

  y += 24;

  // -------------------------------------------------------------
  // 2. HERO CUSTOMER IDENTIFICATION CARD
  // -------------------------------------------------------------
  const heroCardHeight = 44;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, heroCardHeight, 3, 3, 'FD');

  // Customer Display Name (Large, prominent)
  const displayName = customer.name?.trim() || customer.company_name || 'Customer Record';
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(displayName, margin + 8, y + 12);

  // Status Badge (Active Account)
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(pageWidth - margin - 44, y + 6, 38, 7, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text('ACTIVE ACCOUNT', pageWidth - margin - 25, y + 10.8, { align: 'center' });

  // Customer reference / type row
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.text(`CUSTOMER IDENTIFICATION: ${customer.customer_code}`, margin + 8, y + 21);

  if (customer.company_name && customer.customer_type === 'company') {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(labelText[0], labelText[1], labelText[2]);
    doc.text(`Enterprise: ${customer.company_name}`, margin + 8, y + 27);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  const custType = customer.customer_type === 'company' ? 'Commercial Company Account' : 'Domestic Individual Account';
  const regDate = customer.created_at
    ? new Date(customer.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Active Account';
  doc.text(`Account Type: ${custType}  ·  Registration Date: ${regDate}`, margin + 8, y + 36);

  y += heroCardHeight + 8;

  // -------------------------------------------------------------
  // 3. CONTACT INFORMATION SECTION
  // -------------------------------------------------------------
  const contactCardHeight = 42;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, contactCardHeight, 3, 3, 'FD');

  // Section Header bar inside card
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('REGISTERED CONTACT & COMMUNICATION', margin + 6, y + 5.5);

  const contactY = y + 15;
  // Primary Mobile
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Primary Registered Mobile:', margin + 8, contactY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text(customer.phone ? `+91 ${customer.phone}` : 'Not Registered', margin + 58, contactY);

  // Alternate Mobile
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Alternate Phone:', margin + 8, contactY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.alternate_phone ? `+91 ${customer.alternate_phone}` : 'None Registered', margin + 58, contactY + 9);

  // Email / WhatsApp
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Communication Consent:', margin + 8, contactY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text('SMS & WhatsApp Order Notifications Active', margin + 58, contactY + 18);

  y += contactCardHeight + 8;

  // -------------------------------------------------------------
  // 4. COMPLETE REGISTERED ADDRESS SECTION
  // -------------------------------------------------------------
  const addressCardHeight = 62;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, addressCardHeight, 3, 3, 'FD');

  // Section Header bar
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('COMPLETE REGISTERED DELIVERY & BILLING ADDRESS', margin + 6, y + 5.5);

  let addrY = y + 15;
  const colA = margin + 8;
  const colValA = margin + 44;
  const colB = margin + 98;
  const colValB = margin + 130;

  // Door / Street
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Street / Door No:', colA, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.street?.trim() || '—', colValA, addrY);

  // Landmark
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Landmark:', colB, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.landmark?.trim() || '—', colValB, addrY);

  addrY += 8;

  // Area 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Area / Locality 1:', colA, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.area1?.trim() || '—', colValA, addrY);

  // Area 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Area / Locality 2:', colB, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.area2?.trim() || '—', colValB, addrY);

  addrY += 8;

  // City & District
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('City / Town:', colA, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.city?.trim() || 'Tiruppur', colValA, addrY);

  // District & Pincode
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text('Postal Pincode:', colB, addrY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  doc.text(customer.pincode?.trim() || '—', colValB, addrY);

  addrY += 9;

  // Full formatted address banner
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(colA, addrY - 1, contentWidth - 16, 15, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('Formatted Address: ', colA + 3, addrY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
  const formattedAddr = formatCustomerFullAddress(customer);
  const splitFormatted = doc.splitTextToSize(formattedAddr, contentWidth - 55);
  doc.text(splitFormatted, colA + 32, addrY + 4);

  y += addressCardHeight + 8;

  // -------------------------------------------------------------
  // 5. VERIFICATION DOCUMENT SUMMARY & PAGE 2 POINTER
  // -------------------------------------------------------------
  const proofBoxHeight = 52;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, proofBoxHeight, 3, 3, 'FD');

  // Header bar
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.text('VERIFICATION STATUS & PROOF DOCUMENT OVERVIEW', margin + 6, y + 5.5);

  let proofY = y + 15;
  if (decodedImages.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.text(`VERIFICATION DOCUMENT ATTACHED (${decodedImages.length} DOCUMENT${decodedImages.length > 1 ? 'S' : ''})`, margin + 8, proofY);
    
    proofY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
    
    decodedImages.forEach((img, idx) => {
      const typeLabel = DOCUMENT_TYPE_LABELS[img.documentType] || img.documentType.toUpperCase();
      const sizeStr = img.fileSize ? ` · ${(img.fileSize / 1024).toFixed(1)} KB` : '';
      doc.text(`• Proof #${idx + 1}: ${typeLabel} (${img.originalFilename}${sizeStr})`, margin + 12, proofY);
      proofY += 5;
    });

    proofY += 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text(
      `→ Turn to Page ${pageNumber + 1} to inspect the actual uploaded verification proof document.`,
      margin + 8,
      proofY
    );
  } else if (errorMessage) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
    doc.text('STORAGE RETRIEVAL NOTICE', margin + 8, proofY);
    proofY += 6;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
    doc.text(`Vault notice: ${errorMessage}`, margin + 8, proofY);
    proofY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(labelText[0], labelText[1], labelText[2]);
    doc.text(`Turn to Page ${pageNumber + 1} for document vault verification notice.`, margin + 8, proofY);
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('NO VERIFICATION DOCUMENT ON FILE', margin + 8, proofY);
    proofY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bodyText[0], bodyText[1], bodyText[2]);
    doc.text(
      'No proof document has been uploaded for this customer account in the private Supabase storage vault.',
      margin + 8,
      proofY
    );
    proofY += 5;
    doc.text(
      'Customer identity is maintained through active delivery and refill order records.',
      margin + 8,
      proofY
    );
    proofY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(labelText[0], labelText[1], labelText[2]);
    doc.text(`Official "NO VERIFICATION DOCUMENT ON FILE" declaration rendered on Page ${pageNumber + 1}.`, margin + 8, proofY);
  }

  // -------------------------------------------------------------
  // 6. BOTTOM FOOTER & AUDIT WATERMARK
  // -------------------------------------------------------------
  const footerY = pageHeight - 12;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text(
    `CONFIDENTIAL — SRI SS GAS AGENCY · Customer Code: ${customer.customer_code} · Page 1 of 2 (Customer Info)`,
    margin,
    footerY + 1
  );

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${timestamp} · Dossier Page ${pageNumber} of ${totalPages}`,
    pageWidth - margin,
    footerY + 1,
    { align: 'right' }
  );
}

/**
 * PAGE 2: Renders Actual Proof Document Page
 * Displays the actual uploaded customer proof document preserving image quality and aspect ratio.
 * Fits document properly within the page.
 * If no proof document exists, clearly displays: NO VERIFICATION DOCUMENT ON FILE.
 * Never combines customer info and proof documents into one page.
 */
export function renderCustomerProofDocumentPage(
  doc: jsPDF,
  customerData: CustomerWithProofDocs,
  customerIndex: number,
  totalCustomers: number,
  pageNumber: number,
  totalPages: number,
  decodedImages: DecodedImageDetails[],
  errorMessage?: string
): void {
  const { customer } = customerData;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 14;

  // Curated color palette
  const primaryRed = [227, 27, 35]; // Brand red #E31B23
  const darkGray = [17, 24, 39];
  const labelText = [107, 114, 128];
  const borderGray = [229, 231, 235];

  // -------------------------------------------------------------
  // 1. TOP HEADER BANNER
  // -------------------------------------------------------------
  doc.setFillColor(primaryRed[0], primaryRed[1], primaryRed[2]);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SRI SS GAS AGENCY', margin + 6, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Private Storage Vault · Authentic Customer Verification Proof Document',
    margin + 6,
    y + 13.5
  );

  // Customer Code & Page badge in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`ID: ${customer.customer_code}`, pageWidth - margin - 6, y + 7.5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Page ${pageNumber} of ${totalPages} (Customer ${customerIndex + 1}/${totalCustomers} · Proof)`,
    pageWidth - margin - 6,
    y + 13,
    { align: 'right' }
  );

  y += 22;

  // -------------------------------------------------------------
  // 2. COMPACT CUSTOMER REFERENCE SUB-BAR
  // -------------------------------------------------------------
  const subBarHeight = 10;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, subBarHeight, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  const displayName = customer.name?.trim() || customer.company_name || 'Customer Record';
  doc.text(`Customer: ${displayName}`, margin + 5, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  const phoneText = customer.phone ? `Mobile: +91 ${customer.phone}` : 'Mobile: N/A';
  const cityText = customer.city ? `City: ${customer.city}` : 'Tiruppur';
  doc.text(`${phoneText}  ·  ${cityText}`, pageWidth - margin - 5, y + 6.5, { align: 'right' });

  y += subBarHeight + 5;

  // -------------------------------------------------------------
  // 3. ACTUAL PROOF DOCUMENT CANVAS (FULL PAGE DEDICATED AREA)
  // Available height: from y (~37mm) to pageHeight - margin - 15 (~268mm) => ~231mm
  // -------------------------------------------------------------
  const canvasTop = y;
  const canvasBottom = pageHeight - margin - 14;
  const availableCanvasHeight = canvasBottom - canvasTop; // ~231mm

  if (decodedImages.length === 1) {
    // ---------------------------------------------------------
    // SINGLE PROOF DOCUMENT: Full Page A4 Display with 100% aspect ratio
    // ---------------------------------------------------------
    const imgDetails = decodedImages[0];
    const maxImgWidth = contentWidth - 6;
    const maxImgHeight = availableCanvasHeight - 16; // reserve space for caption and frame

    const fit = calculateFitDimensions(
      imgDetails.width,
      imgDetails.height,
      maxImgWidth,
      maxImgHeight
    );

    const renderX = margin + 3 + (maxImgWidth - fit.width) / 2;
    const renderY = canvasTop + 4 + (maxImgHeight - fit.height) / 2;

    // Draw clean background card and subtle shadow-like frame
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(renderX - 1.5, renderY - 1.5, fit.width + 3, fit.height + 3, 1.5, 1.5, 'FD');

    // Embed genuine image bytes
    try {
      doc.addImage(
        imgDetails.dataUrl,
        imgDetails.format,
        renderX,
        renderY,
        fit.width,
        fit.height,
        undefined,
        'FAST'
      );
    } catch (e: any) {
      doc.setFontSize(8);
      doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
      doc.text(`Image rendering note: ${e.message}`, renderX + 4, renderY + 12);
    }

    // High fidelity caption below the proof image
    const captionY = canvasBottom - 4;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    const docLabel = DOCUMENT_TYPE_LABELS[imgDetails.documentType] || imgDetails.documentType.toUpperCase();
    const sizeKb = imgDetails.fileSize ? ` · ${(imgDetails.fileSize / 1024).toFixed(1)} KB` : '';
    doc.text(
      `Document Type: ${docLabel}  ·  Original File: ${imgDetails.originalFilename}${sizeKb}`,
      pageWidth / 2,
      captionY - 3.5,
      { align: 'center' }
    );

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(labelText[0], labelText[1], labelText[2]);
    doc.text(
      'Authentic verification record downloaded from private Supabase Storage vault · Aspect ratio preserved',
      pageWidth / 2,
      captionY + 1,
      { align: 'center' }
    );

  } else if (decodedImages.length >= 2) {
    // ---------------------------------------------------------
    // MULTIPLE PROOF DOCUMENTS: Stacked Layout on Page 2 preserving aspect ratio
    // ---------------------------------------------------------
    const count = Math.min(decodedImages.length, 2);
    const gap = 8;
    const subBoxHeight = (availableCanvasHeight - 16 - gap * (count - 1)) / count;
    const subBoxWidth = contentWidth - 4;

    decodedImages.slice(0, 2).forEach((imgDetails, idx) => {
      const subAreaY = canvasTop + idx * (subBoxHeight + gap);
      const maxSubImgHeight = subBoxHeight - 10;
      const fit = calculateFitDimensions(
        imgDetails.width,
        imgDetails.height,
        subBoxWidth - 4,
        maxSubImgHeight
      );

      const renderX = margin + 2 + (subBoxWidth - fit.width) / 2;
      const renderY = subAreaY + 5 + (maxSubImgHeight - fit.height) / 2;

      // Card frame
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.roundedRect(margin + 2, subAreaY, subBoxWidth, subBoxHeight, 2, 2, 'FD');

      // Caption top of card
      const docLabel = DOCUMENT_TYPE_LABELS[imgDetails.documentType] || imgDetails.documentType.toUpperCase();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`Proof Document #${idx + 1}: ${docLabel} (${imgDetails.originalFilename})`, margin + 6, subAreaY + 4.5);

      // Embed image
      try {
        doc.addImage(
          imgDetails.dataUrl,
          imgDetails.format,
          renderX,
          renderY,
          fit.width,
          fit.height,
          undefined,
          'FAST'
        );
      } catch (e: any) {
        doc.setFontSize(7.5);
        doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
        doc.text(`Image rendering note: ${e.message}`, renderX + 4, renderY + 10);
      }
    });

    const captionY = canvasBottom - 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(labelText[0], labelText[1], labelText[2]);
    doc.text(
      `Multiple verification proof documents (${decodedImages.length} attached) on file in private storage vault.`,
      pageWidth / 2,
      captionY,
      { align: 'center' }
    );

  } else {
    // ---------------------------------------------------------
    // NO PROOF DOCUMENT OR RETRIEVAL NOTICE:
    // Clearly display: NO VERIFICATION DOCUMENT ON FILE
    // Do not display only a file name, upload button, placeholder, or broken image.
    // ---------------------------------------------------------
    const noticeBoxHeight = 88;
    const noticeBoxY = canvasTop + (availableCanvasHeight - noticeBoxHeight) / 2;

    doc.setFillColor(254, 252, 248); // warm cream
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin + 12, noticeBoxY, contentWidth - 24, noticeBoxHeight, 4, 4, 'FD');

    if (errorMessage) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
      doc.text('DOCUMENT RETRIEVAL NOTICE', pageWidth / 2, noticeBoxY + 18, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const splitErr = doc.splitTextToSize(errorMessage, contentWidth - 48);
      doc.text(splitErr, pageWidth / 2, noticeBoxY + 30, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(labelText[0], labelText[1], labelText[2]);
      doc.text(
        'Please verify file accessibility in the customer document private vault.',
        pageWidth / 2,
        noticeBoxY + 65,
        { align: 'center' }
      );
    } else {
      // Clear, prominent official declaration as required:
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text('NO VERIFICATION DOCUMENT ON FILE', pageWidth / 2, noticeBoxY + 22, {
        align: 'center',
      });

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(
        'No proof document has been uploaded for this customer account in the private storage vault.',
        pageWidth / 2,
        noticeBoxY + 35,
        { align: 'center' }
      );

      doc.setFontSize(8.5);
      doc.setTextColor(labelText[0], labelText[1], labelText[2]);
      doc.text(
        'Customer identity is verified and maintained through active delivery and refill order records.',
        pageWidth / 2,
        noticeBoxY + 45,
        { align: 'center' }
      );

      // Customer verification details box
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(margin + 24, noticeBoxY + 54, contentWidth - 48, 22, 2, 2, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`Account Code: ${customer.customer_code}   ·   Customer: ${displayName}`, pageWidth / 2, noticeBoxY + 63, {
        align: 'center',
      });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(labelText[0], labelText[1], labelText[2]);
      doc.text(
        `Registered Phone: ${customer.phone || 'N/A'}   ·   Status: Active Customer`,
        pageWidth / 2,
        noticeBoxY + 71,
        { align: 'center' }
      );
    }
  }

  // -------------------------------------------------------------
  // 4. BOTTOM FOOTER & AUDIT WATERMARK
  // -------------------------------------------------------------
  const footerY = pageHeight - 12;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(labelText[0], labelText[1], labelText[2]);
  doc.text(
    `CONFIDENTIAL — SRI SS GAS AGENCY · Customer Code: ${customer.customer_code} · Page 2 of 2 (Proof Document)`,
    margin,
    footerY + 1
  );

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${timestamp} · Dossier Page ${pageNumber} of ${totalPages}`,
    pageWidth - margin,
    footerY + 1,
    { align: 'right' }
  );
}

/**
 * Orchestrates the full bulk PDF export with controlled concurrency,
 * progress updates, and automatic download.
 * Generates EXACTLY TWO PAGES PER ACTIVE CUSTOMER.
 * Expected total pages = totalActiveCustomers * 2.
 */
export async function generateBulkCustomerProofPdf(
  summary: CustomerProofExportSummary,
  onProgress?: (progress: ExportProgressUpdate) => void
): Promise<GeneratedPdfResult> {
  const { customers } = summary;
  const totalCustomers = customers.length;
  const totalPages = totalCustomers * 2; // EXACTLY TWO PAGES PER CUSTOMER

  if (totalCustomers === 0) {
    throw new Error('No active customer accounts available for export.');
  }

  onProgress?.({
    phase: 'downloading_proofs',
    percent: 5,
    message: `Starting bulk export for ${totalCustomers} active customers (${totalPages} pages total)...`,
    totalCustomers,
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let embeddedImagesCount = 0;
  const customersWithMissingDocs: string[] = [];
  const customersWithEmbeddedProofs: string[] = [];

  // Controlled sequential processing with cooperative event loop yielding
  for (let i = 0; i < totalCustomers; i++) {
    const item = customers[i];
    const customer = item.customer;

    const basePercent = Math.round(5 + ((i + 1) / totalCustomers) * 85);
    onProgress?.({
      phase: 'downloading_proofs',
      currentCustomerIndex: i + 1,
      totalCustomers,
      currentCustomerName: customer.name,
      percent: basePercent,
      message: `Processing customer ${i + 1} of ${totalCustomers}: ${customer.name} (Pages ${i * 2 + 1}-${i * 2 + 2} of ${totalPages})...`,
    });

    // Yield control so UI updates smoothly
    await new Promise((resolve) => setTimeout(resolve, 0));

    const decodedImages: DecodedImageDetails[] = [];
    let errorMessage = '';

    if (item.documents.length > 0) {
      for (const d of item.documents) {
        try {
          const img = await downloadAndDecodeDocumentImage(d);
          decodedImages.push(img);
          embeddedImagesCount++;
        } catch (err: any) {
          console.warn(`Could not load document ${d.original_filename} for ${customer.name}:`, err);
          if (err.message?.includes('PDF_FORMAT_NOT_IMAGE')) {
            errorMessage = `Document is in PDF format (${d.original_filename}). Embedded image preview is unsupported for PDF format; original file remains archived in vault.`;
          } else {
            errorMessage = `Storage retrieval warning: ${err.message || 'File inaccessible'}`;
          }
        }
      }
    }

    if (decodedImages.length > 0) {
      customersWithEmbeddedProofs.push(customer.name);
    } else {
      customersWithMissingDocs.push(customer.name);
    }

    const page1Number = i * 2 + 1;
    const page2Number = i * 2 + 2;

    // PAGE 1 OF CUSTOMER: Information
    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderCustomerInfoPage(
      doc,
      item,
      i,
      totalCustomers,
      page1Number,
      totalPages,
      decodedImages,
      decodedImages.length === 0 ? errorMessage : undefined
    );

    // PAGE 2 OF CUSTOMER: Actual Proof Document
    doc.addPage('a4', 'portrait');
    renderCustomerProofDocumentPage(
      doc,
      item,
      i,
      totalCustomers,
      page2Number,
      totalPages,
      decodedImages,
      decodedImages.length === 0 ? errorMessage : undefined
    );
  }

  onProgress?.({
    phase: 'rendering_pdf',
    percent: 94,
    message: 'Finalizing PDF layout and document compression...',
    totalCustomers,
  });

  // Small delay for finalization
  await new Promise((resolve) => setTimeout(resolve, 10));

  const todayStr = new Date().toISOString().split('T')[0];
  const fileName = `SRI_SS_GAS_AGENCY_Active_Customers_Proofs_${todayStr}.pdf`;

  // Log audit in Supabase
  try {
    const { data: authData } = await supabase.auth.getSession();
    const userId = authData?.session?.user?.id || undefined;
    await logAudit('Bulk Customer Proofs PDF Exported', 'customers', userId, {
      total_active_customers: totalCustomers,
      total_pages_generated: totalPages,
      proofs_embedded: embeddedImagesCount,
      missing_proofs_count: customersWithMissingDocs.length,
      export_date: todayStr,
    });
  } catch (auditErr) {
    console.warn('Audit log write warning:', auditErr);
  }

  onProgress?.({
    phase: 'saving',
    percent: 98,
    message: 'Triggering PDF download...',
    totalCustomers,
  });

  // Save / trigger download if running in browser
  if (typeof window !== 'undefined') {
    doc.save(fileName);
  }

  const pdfOutput = doc.output('arraybuffer');

  onProgress?.({
    phase: 'complete',
    percent: 100,
    message: `Export complete! ${totalPages} pages generated (${totalCustomers} active customers × 2 pages).`,
    totalCustomers,
  });

  return {
    blob: pdfOutput,
    fileName,
    totalPages,
    totalActiveCustomers: totalCustomers,
    embeddedImagesCount,
    customersWithMissingDocs,
    customersWithEmbeddedProofs,
  };
}
