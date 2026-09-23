import React from 'react';
import { Download, Printer, X, FileText, Loader2 } from 'lucide-react';
import {
  type InvoiceData,
  formatCylinderItemDescription,
  formatEmptyReturnLabel,
} from '../../lib/invoicePdfExport';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: InvoiceData | null;
  onDownloadPdf: () => Promise<void>;
  isGeneratingPdf: boolean;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  invoiceData,
  onDownloadPdf,
  isGeneratingPdf,
}) => {
  if (!isOpen || !invoiceData) return null;

  const handlePrint = () => {
    window.print();
  };

  const emptyNotesParts: string[] = [];
  if (invoiceData.emptyReturned && invoiceData.emptyReturned.quantity > 0) {
    emptyNotesParts.push(
      formatEmptyReturnLabel(invoiceData.emptyReturned.quantity, invoiceData.emptyReturned.sizeLabel)
    );
  }
  if (invoiceData.securityDeposit && invoiceData.securityDeposit > 0) {
    emptyNotesParts.push(
      `Security Deposit: ₹${invoiceData.securityDeposit.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

  const fullAddress =
    [invoiceData.customerAddress, invoiceData.customerCity].filter(Boolean).join(', ') ||
    'Tiruppur, Tamil Nadu';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl flex flex-col max-h-[96vh] my-auto overflow-hidden modal-enter">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-neutral-800/90 border-b border-neutral-700 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#E31B23]" />
            <div>
              <h2 id="preview-modal-title" className="text-sm font-bold tracking-tight">
                Invoice Preview ({invoiceData.invoiceType === 'gst' ? 'GST Tax Invoice' : 'Retail Bill'})
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                {invoiceData.invoiceNumber} · A4 Portrait Document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors border border-neutral-600"
              title="Print Document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={onDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-lg shadow-sm transition-all active:scale-98 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors ml-1"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area (Isolated horizontal scroll on mobile if needed) */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-6 bg-neutral-950 flex justify-center">
          {/* A4 Sheet Container */}
          <div
            className="w-full max-w-[700px] min-w-[560px] bg-white text-[#171717] rounded-sm shadow-2xl p-6 sm:p-8 border border-neutral-300 font-sans select-text text-left my-auto"
            style={{
              minHeight: '880px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* 1. Header (Agency Info Left | SUPERGAS Logo Right) */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-[#CC0000]">
              <div className="space-y-1">
                <h1 className="text-xl font-black text-[#CC0000] tracking-tight">
                  SRI SS GAS AGENCY
                </h1>
                <p className="text-[11px] text-neutral-700 leading-relaxed font-medium">
                  10/699, MP COMPLEX, Karaipudur Main Rd, Chinnakarai,
                  <br />
                  Tiruppur, Tamil Nadu 641605
                </p>
                <p className="text-[11px] text-neutral-800 font-semibold pt-0.5">
                  Phone: <span className="font-bold">+91 86672109929</span>
                  <span className="mx-2 text-neutral-400">|</span>
                  Email: <span className="font-bold">srissgasagency@gmail.com</span>
                </p>
              </div>

              <div className="shrink-0 pl-4 pt-1">
                <img
                  src="/assets/supergas-horizontal-logo.png"
                  alt="SUPERGAS"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to secondary logo if horizontal is missing
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* 2. Side-by-Side Details: INVOICE DETAILS & BILLED TO / CUSTOMER */}
            <div className="grid grid-cols-2 gap-3.5 my-4">
              {/* Left Box: INVOICE DETAILS */}
              <div className="border border-neutral-300 rounded-sm overflow-hidden">
                <div className="bg-[#FDF2F2] px-3 py-1.5 border-b border-neutral-300">
                  <h3 className="text-[11px] font-black text-[#CC0000] uppercase tracking-wider">
                    INVOICE DETAILS
                  </h3>
                </div>
                <div className="p-3 text-[11px] space-y-1.5">
                  <div className="flex">
                    <span className="w-24 text-neutral-600 font-medium">Invoice No</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-bold text-neutral-900 font-mono">
                      {invoiceData.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-neutral-600 font-medium">Invoice Date</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-medium text-neutral-900">
                      {invoiceData.invoiceDate}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-neutral-600 font-medium">Payment Mode</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-bold text-neutral-900 uppercase">
                      {(invoiceData.paymentMode || 'Cash').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-neutral-600 font-medium">Place of Supply</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-medium text-neutral-900">Tamil Nadu</span>
                  </div>
                </div>
              </div>

              {/* Right Box: BILLED TO / CUSTOMER */}
              <div className="border border-neutral-300 rounded-sm overflow-hidden">
                <div className="bg-[#FDF2F2] px-3 py-1.5 border-b border-neutral-300">
                  <h3 className="text-[11px] font-black text-[#CC0000] uppercase tracking-wider">
                    BILLED TO / CUSTOMER
                  </h3>
                </div>
                <div className="p-3 text-[11px] space-y-1.5">
                  <div className="flex">
                    <span className="w-16 text-neutral-600 font-medium">Name</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-bold text-neutral-900">
                      {invoiceData.customerName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-neutral-600 font-medium">Address</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-medium text-neutral-800 leading-tight">
                      {fullAddress}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-16 text-neutral-600 font-medium">Phone</span>
                    <span className="text-neutral-400 mr-2">:</span>
                    <span className="font-medium text-neutral-900">
                      {invoiceData.customerPhone || '—'}
                    </span>
                  </div>
                  {invoiceData.customerGstin && (
                    <div className="flex">
                      <span className="w-16 text-neutral-600 font-medium">GSTIN</span>
                      <span className="text-neutral-400 mr-2">:</span>
                      <span className="font-mono font-bold text-neutral-900">
                        {invoiceData.customerGstin}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Item Table — EXACTLY 5 COLUMNS */}
            <div className="border border-neutral-300 rounded-sm overflow-hidden my-4">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#CC0000] text-white font-bold border-b border-neutral-300">
                    <th className="py-2 px-2 text-center w-12 border-r border-red-700/50">S.No.</th>
                    <th className="py-2 px-3 text-left border-r border-red-700/50">Item Description</th>
                    <th className="py-2 px-3 text-center w-28 border-r border-red-700/50">Rate (₹)</th>
                    <th className="py-2 px-3 text-center w-20 border-r border-red-700/50">Quantity</th>
                    <th className="py-2 px-3 text-right w-28">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {invoiceData.items.map((item, idx) => {
                    const cleanDesc = formatCylinderItemDescription(item.description);
                    const itemAmount = item.rate * item.quantity;
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="py-2 px-2 text-center text-neutral-600 border-r border-neutral-200">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 text-left font-medium text-neutral-900 border-r border-neutral-200">
                          {cleanDesc}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-neutral-800 border-r border-neutral-200">
                          {item.rate.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-neutral-900 border-r border-neutral-200">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                          {itemAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* 4. Bottom Section: Regular Total or GST Tax Summary */}
                {invoiceData.invoiceType === 'gst' ? (
                  <tfoot className="border-t border-neutral-300">
                    {(() => {
                      const isInterState = (invoiceData.igstAmount ?? 0) > 0;
                      const taxableVal = invoiceData.taxableAmount ?? invoiceData.subtotal;
                      const cgstVal = invoiceData.cgstAmount ?? 0;
                      const sgstVal = invoiceData.sgstAmount ?? 0;
                      const igstVal = invoiceData.igstAmount ?? 0;
                      const roundOffVal = invoiceData.roundOff ?? 0;

                      return (
                        <>
                          <tr className="border-b border-neutral-200">
                            <td colSpan={2} rowSpan={isInterState ? 4 : 5} className="py-2.5 px-3 bg-white border-r border-neutral-300 align-top text-left">
                              <div className="space-y-1.5 text-[10.5px]">
                                {emptyNotesParts.length > 0 && (
                                  <div className="font-bold text-neutral-900 pb-1 border-b border-neutral-100">
                                    {emptyNotesParts.join('   |   ')}
                                  </div>
                                )}
                                <div className="text-neutral-600">
                                  <span className="font-medium">Place of Supply:</span>{' '}
                                  <span className="font-semibold text-neutral-800">
                                    {invoiceData.placeOfSupply || (isInterState ? (invoiceData.customerState || 'Other') : 'Tamil Nadu (33)')}
                                  </span>
                                </div>
                                <div className="text-neutral-500 text-[10px]">
                                  Tax Payable on Reverse Charge: No
                                </div>
                              </div>
                            </td>
                            <td colSpan={2} className="py-1.5 px-3 text-left font-medium text-neutral-700 bg-neutral-50/60 border-r border-neutral-200">
                              Taxable Value / Net Price
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-neutral-900">
                              ₹{taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {isInterState ? (
                            <tr className="border-b border-neutral-200">
                              <td colSpan={2} className="py-1.5 px-3 text-left font-medium text-neutral-700 bg-neutral-50/60 border-r border-neutral-200">
                                IGST (18%)
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-neutral-900">
                                ₹{igstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ) : (
                            <>
                              <tr className="border-b border-neutral-200">
                                <td colSpan={2} className="py-1.5 px-3 text-left font-medium text-neutral-700 bg-neutral-50/60 border-r border-neutral-200">
                                  CGST (9%)
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold text-neutral-900">
                                  ₹{cgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                              <tr className="border-b border-neutral-200">
                                <td colSpan={2} className="py-1.5 px-3 text-left font-medium text-neutral-700 bg-neutral-50/60 border-r border-neutral-200">
                                  SGST (9%)
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold text-neutral-900">
                                  ₹{sgstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </>
                          )}

                          <tr className="border-b border-neutral-200">
                            <td colSpan={2} className="py-1.5 px-3 text-left font-medium text-neutral-700 bg-neutral-50/60 border-r border-neutral-200">
                              Round Off
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-medium text-neutral-700">
                              {roundOffVal > 0 ? '+' : ''}₹{roundOffVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>

                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-left font-black text-white bg-[#CC0000] border-r border-red-700/50">
                              Grand Total
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-white bg-[#CC0000]">
                              ₹{invoiceData.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tfoot>
                ) : (
                  <tfoot className="border-t border-neutral-300">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 bg-white border-r border-neutral-300">
                        {emptyNotesParts.length > 0 ? (
                          <span className="text-[11px] font-bold text-neutral-900">
                            {emptyNotesParts.join('   |   ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 italic">
                            Sri SS Gas Agency Official Bill
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-white bg-[#CC0000] border-r border-red-700/50">
                        Total
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-white bg-[#CC0000]">
                        ₹{invoiceData.grandTotal.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* 5. Bottom Right: Authorized Signature */}
            <div className="pt-8 flex justify-end">
              <div className="w-56 text-center space-y-1.5">
                <p className="text-[11px] text-neutral-800 font-medium">
                  For <span className="font-bold text-neutral-950">SRI SS GAS AGENCY</span>
                </p>
                <div className="h-14 flex items-center justify-center">
                  <img
                    src="/assets/authorized-signature.png"
                    alt="Authorized Signature"
                    className="h-12 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="border-t border-neutral-400 pt-1">
                  <p className="text-[10px] text-neutral-600 font-semibold uppercase tracking-wider">
                    Authorized Signatory
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-neutral-400 hidden sm:inline">
            Verify all line items and customer information before final export.
          </span>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors border border-neutral-700"
            >
              Back to Form
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-black bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
