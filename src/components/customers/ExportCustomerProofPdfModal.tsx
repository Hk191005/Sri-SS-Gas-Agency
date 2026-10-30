import React, { useState, useEffect, useMemo } from 'react';
import {
  FileDown,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Users,
  Search,
  Download,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useModalEscape } from '../../hooks/useModalEscape';
import { ModalPortal } from '../common/ModalPortal';
import { AGENCY_BRANDING } from '../../lib/constants';
import {
  fetchActiveCustomersAndProofsSummary,
  generateBulkCustomerProofPdf,
  DOCUMENT_TYPE_LABELS,
  type CustomerProofExportSummary,
  type ExportProgressUpdate,
  type GeneratedPdfResult,
} from '../../lib/customerProofsPdfExport';

interface ExportCustomerProofPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportCustomerProofPdfModal: React.FC<ExportCustomerProofPdfModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Prevent escape close during generation to avoid interrupting export
  const [isGenerating, setIsGenerating] = useState(false);
  useModalEscape(isOpen && !isGenerating, onClose);

  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<CustomerProofExportSummary | null>(null);
  const [loadError, setLoadError] = useState('');

  // Generation state
  const [progress, setProgress] = useState<ExportProgressUpdate | null>(null);
  const [result, setResult] = useState<GeneratedPdfResult | null>(null);
  const [generationError, setGenerationError] = useState('');

  // Preview filtering inside the modal
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'with_docs' | 'missing_docs'>('all');

  // Verify Administrator / Owner authorization
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    const emailLower = (user.email || '').toLowerCase();
    const roleLower = (user.role || '').toLowerCase();
    return (
      AGENCY_BRANDING.ADMIN_EMAILS.some((adm) => adm.toLowerCase() === emailLower) ||
      roleLower.includes('owner') ||
      roleLower.includes('admin')
    );
  }, [user]);

  // Load summary whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
      setProgress(null);
      setResult(null);
      setLoadError('');
      setGenerationError('');
      setIsGenerating(false);
      setSearchQuery('');
      setActiveFilterTab('all');
      return;
    }

    if (!isAuthorized) {
      setLoadError('Unauthorized: Bulk customer proof export is strictly restricted to Agency Owners and Authorized Administrators.');
      return;
    }

    const loadSummaryData = async () => {
      setLoadingSummary(true);
      setLoadError('');
      try {
        const data = await fetchActiveCustomersAndProofsSummary();
        setSummary(data);
      } catch (err: any) {
        console.error('Failed to load active customers proof summary:', err);
        setLoadError(err.message || 'Failed to inspect customer records and storage vault.');
      } finally {
        setLoadingSummary(false);
      }
    };

    loadSummaryData();
  }, [isOpen, isAuthorized]);

  // Filter preview customers list
  const filteredCustomers = useMemo(() => {
    if (!summary) return [];
    let list = [...summary.customers];

    if (activeFilterTab === 'with_docs') {
      list = list.filter((c) => c.hasProof);
    } else if (activeFilterTab === 'missing_docs') {
      list = list.filter((c) => !c.hasProof);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.customer.name?.toLowerCase().includes(q) ||
          c.customer.customer_code?.toLowerCase().includes(q) ||
          c.customer.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [summary, activeFilterTab, searchQuery]);

  const handleStartExport = async () => {
    if (!summary || isGenerating || !isAuthorized) return;

    setIsGenerating(true);
    setGenerationError('');
    setProgress({
      phase: 'fetching_records',
      percent: 2,
      message: 'Preparing active customer list and document vault references...',
    });

    try {
      const exportResult = await generateBulkCustomerProofPdf(summary, (p) => {
        setProgress(p);
      });

      setResult(exportResult);
      showSuccess(
        `PDF Dossier generated successfully! ${exportResult.totalPages} pages, ${exportResult.embeddedImagesCount} proof images embedded.`
      );
    } catch (err: any) {
      console.error('Bulk customer proof PDF generation failed:', err);
      setGenerationError(err.message || 'PDF generation encountered an error.');
      showError(err.message || 'Failed to generate customer proof PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAgain = () => {
    if (!result?.blob || typeof window === 'undefined') return;
    const blob =
      result.blob instanceof Blob
        ? result.blob
        : new Blob([result.blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#F1F5F9] dark:border-[#262626] flex items-center justify-between bg-[#FAFAFA] dark:bg-[#1E1E1E] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] flex items-center justify-center shrink-0 border border-red-200/50 dark:border-red-900/40 shadow-xs">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                  Export Active Customers PDF
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#FFF1F2] dark:bg-red-950/50 text-[#E31B23] border border-red-200/50 dark:border-red-900/50">
                    A4 Dossier
                  </span>
                </h3>
                <p className="text-[11px] font-semibold text-[#525252] dark:text-[#A3A3A3] mt-0.5">
                  TWO pages per active customer (Page 1: Customer Details, Page 2: Actual Proof Document)
                </p>
              </div>
            </div>

            {!isGenerating && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[#737373] hover:text-[#171717] dark:hover:text-white rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#262626] transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
            {/* Unauthorized State */}
            {!isAuthorized && (
              <div className="p-4 bg-[#FFF1F2] dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-xs text-[#DC2626] font-bold">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm">Access Restricted</h4>
                  <p className="mt-1 leading-relaxed text-[#B91C1C] dark:text-red-300">
                    {loadError || 'Only authorized agency owner/administrator accounts can perform bulk PDF exports.'}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {loadError && isAuthorized && (
              <div className="p-4 bg-[#FFF1F2] border border-[#FFD6D8] rounded-xl flex items-start gap-3 text-xs text-[#DC2626] font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm">Inspection Error</h4>
                  <p className="mt-1 font-semibold">{loadError}</p>
                </div>
              </div>
            )}

            {/* Loading Summary State */}
            {loadingSummary && (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#E31B23] mx-auto" />
                <p className="text-xs font-bold text-[#171717] dark:text-white">
                  Inspecting active customer records & private vault documents...
                </p>
                <p className="text-[11px] text-[#737373]">
                  Verifying storage file existence, mime types and customer lifecycle status
                </p>
              </div>
            )}

            {/* In-Progress State */}
            {isGenerating && progress && (
              <div className="p-6 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-2xl border border-[#E5E5E5] dark:border-[#2E2E2E] space-y-4">
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="text-[#171717] dark:text-white flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#E31B23]" />
                    <span>Generating Production PDF Dossier...</span>
                  </span>
                  <span className="text-[#E31B23] font-black text-sm">{progress.percent}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#E5E5E5] dark:bg-[#333] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#E31B23] to-[#C9151C] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(4, progress.percent)}%` }}
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#171717] dark:text-white">{progress.message}</p>
                  {progress.currentCustomerName && (
                    <p className="text-[11px] font-semibold text-[#737373]">
                      Current account: {progress.currentCustomerName} (Page {progress.currentCustomerIndex} of {progress.totalCustomers})
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#E5E5E5] dark:border-[#2E2E2E] flex items-center gap-2 text-[11px] text-[#525252] dark:text-[#A3A3A3] font-medium">
                  <Lock className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  <span>Images downloaded via authenticated session with 100% aspect ratio preserved.</span>
                </div>
              </div>
            )}

            {/* Generation Error */}
            {generationError && (
              <div className="p-4 bg-[#FFF1F2] border border-[#FFD6D8] rounded-xl flex items-start gap-3 text-xs text-[#DC2626] font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm">Export Failed</h4>
                  <p className="mt-1 font-semibold">{generationError}</p>
                </div>
              </div>
            )}

            {/* Completed Result State */}
            {!isGenerating && result && (
              <div className="space-y-5">
                <div className="p-5 bg-[#F0FDF4] dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-start gap-3.5 text-xs text-[#16A34A]">
                  <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5 text-[#16A34A]" />
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-[#15803D] dark:text-emerald-400">
                      Bulk PDF Export Generated Successfully!
                    </h4>
                    <p className="font-semibold text-[#166534] dark:text-emerald-300 leading-relaxed">
                      Downloaded file: <span className="font-mono font-bold text-xs">{result.fileName}</span>
                    </p>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1E1E1E] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E] text-center">
                    <p className="text-[10px] font-extrabold uppercase text-[#737373]">Total A4 Pages</p>
                    <p className="text-xl font-black text-[#171717] dark:text-white mt-1">
                      {result.totalPages}
                    </p>
                    <p className="text-[10px] text-[#737373] mt-0.5">2 pages per active customer</p>
                  </div>

                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1E1E1E] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E] text-center">
                    <p className="text-[10px] font-extrabold uppercase text-[#16A34A]">Proofs Embedded</p>
                    <p className="text-xl font-black text-[#16A34A] mt-1">
                      {result.embeddedImagesCount}
                    </p>
                    <p className="text-[10px] text-[#737373] mt-0.5">Real image bytes</p>
                  </div>

                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1E1E1E] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E] text-center">
                    <p className="text-[10px] font-extrabold uppercase text-[#D97706]">Missing Proofs</p>
                    <p className="text-xl font-black text-[#D97706] mt-1">
                      {result.customersWithMissingDocs.length}
                    </p>
                    <p className="text-[10px] text-[#737373] mt-0.5">Flagged on Page 2</p>
                  </div>
                </div>

                {/* Missing documents callout if any */}
                {result.customersWithMissingDocs.length > 0 && (
                  <div className="p-4 bg-[#FFFBEB] dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2">
                    <h5 className="text-xs font-black text-[#B45309] dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{result.customersWithMissingDocs.length} Customers With Missing Proof Documents</span>
                    </h5>
                    <p className="text-[11px] text-[#92400E] dark:text-amber-300 leading-relaxed font-semibold">
                      Their customer details are rendered on Page 1, with Page 2 displaying an authoritative &quot;NO VERIFICATION DOCUMENT ON FILE&quot; notice:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                      {result.customersWithMissingDocs.map((name, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white dark:bg-[#1E1E1E] border border-amber-200 dark:border-amber-800/60 rounded-md text-[10px] font-bold text-[#78350F] dark:text-amber-200"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Initial Preview State */}
            {!loadingSummary && !isGenerating && !result && summary && (
              <div className="space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E]">
                    <div className="flex items-center justify-between text-[#525252] dark:text-[#A3A3A3]">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">Active Customers</span>
                      <Users className="w-4 h-4 text-[#E31B23]" />
                    </div>
                    <p className="text-2xl font-black text-[#171717] dark:text-white mt-1.5">
                      {summary.totalActiveCustomers}
                    </p>
                    <p className="text-[10px] font-semibold text-[#737373] mt-0.5">
                      100% Active (Inactive excluded)
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E]">
                    <div className="flex items-center justify-between text-[#525252] dark:text-[#A3A3A3]">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">Proof Documents</span>
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                    </div>
                    <p className="text-2xl font-black text-[#16A34A] mt-1.5">
                      {summary.totalAvailableDocsCount}
                    </p>
                    <p className="text-[10px] font-semibold text-[#737373] mt-0.5">
                      Across {summary.customersWithDocsCount} verified accounts
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E]">
                    <div className="flex items-center justify-between text-[#525252] dark:text-[#A3A3A3]">
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">Missing Proofs</span>
                      <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                    </div>
                    <p className="text-2xl font-black text-[#D97706] mt-1.5">
                      {summary.customersWithoutDocsCount}
                    </p>
                    <p className="text-[10px] font-semibold text-[#737373] mt-0.5">
                      Reported clearly on page
                    </p>
                  </div>
                </div>

                {/* PDF Specifications Callout */}
                <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2E2E2E] flex items-start gap-3">
                  <Shield className="w-5 h-5 text-[#E31B23] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <h5 className="font-black text-[#171717] dark:text-white">
                      Mandatory Layout Specifications
                    </h5>
                    <ul className="text-[11px] text-[#525252] dark:text-[#A3A3A3] space-y-0.5 list-disc list-inside font-semibold">
                      <li>Format: A4 portrait, exactly TWO pages per customer ({(summary?.totalActiveCustomers || 0) * 2} total pages).</li>
                      <li>Page 1 (Customer Information): Customer name, registered mobile, complete address, identification code (SSG-XXXXXX).</li>
                      <li>Page 2 (Proof Document): Full-page authentic proof image (aspect ratio preserved), or &quot;NO VERIFICATION DOCUMENT ON FILE&quot;.</li>
                      <li>Sorted alphabetically by customer name with authentic storage byte embedding.</li>
                    </ul>
                  </div>
                </div>

                {/* Customer Preview List with Tabs & Search */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          activeFilterTab === 'all'
                            ? 'bg-[#E31B23] text-white'
                            : 'bg-[#F1F5F9] dark:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        All Active ({summary.totalActiveCustomers})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab('with_docs')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          activeFilterTab === 'with_docs'
                            ? 'bg-[#16A34A] text-white'
                            : 'bg-[#F1F5F9] dark:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        With Proofs ({summary.customersWithDocsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilterTab('missing_docs')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          activeFilterTab === 'missing_docs'
                            ? 'bg-[#D97706] text-white'
                            : 'bg-[#F1F5F9] dark:bg-[#262626] text-[#525252] dark:text-[#D4D4D4] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        Missing ({summary.customersWithoutDocsCount})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#737373]" />
                      <input
                        type="text"
                        placeholder="Search preview list..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2E2E2E] rounded-lg text-xs font-bold text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:border-[#E31B23]"
                      />
                    </div>
                  </div>

                  {/* Scrollable List */}
                  <div className="border border-[#E5E5E5] dark:border-[#2E2E2E] rounded-xl divide-y divide-[#F1F1F1] dark:divide-[#262626] max-h-52 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#737373]">
                        No active customers matched the preview filter.
                      </div>
                    ) : (
                      filteredCustomers.map((c, idx) => (
                        <div
                          key={c.customer.id}
                          className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-[#737373] text-[10px] w-6 shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="font-black text-[#171717] dark:text-white truncate max-w-xs">
                                {c.customer.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F1F5F9] dark:bg-[#2A2A2A] text-[#525252] dark:text-[#A3A3A3] font-bold">
                                {c.customer.customer_code}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#737373] mt-0.5 pl-8">
                              Phone: {c.customer.phone} · City: {c.customer.city || 'Tiruppur'}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {c.hasProof ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#F0FDF4] text-[#16A34A] border border-emerald-200/60">
                                <CheckCircle2 className="w-3 h-3" />
                                {c.documents
                                  .map((d) => DOCUMENT_TYPE_LABELS[d.document_type] || d.document_type)
                                  .join(', ')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#FFFBEB] text-[#D97706] border border-amber-200/60">
                                <AlertTriangle className="w-3 h-3" />
                                Missing Proof
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="px-5 py-4 border-t border-[#F1F5F9] dark:border-[#262626] flex items-center justify-between bg-[#FAFAFA] dark:bg-[#1E1E1E] shrink-0">
            <span className="text-[11px] font-semibold text-[#737373]">
              {result
                ? `${result.totalPages} pages generated (${result.totalActiveCustomers} active customers × 2 pages)`
                : summary
                ? `${summary.totalActiveCustomers} active customers (${summary.totalActiveCustomers * 2} pages) ready for export`
                : 'Inspecting vault...'}
            </span>

            <div className="flex items-center gap-2.5">
              {!result && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isGenerating}
                  className="px-4 py-2.5 text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#F1F5F9] dark:hover:bg-[#262626] rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              )}

              {result ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadAgain}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-white dark:bg-[#262626] hover:bg-[#F5F5F5] text-[#171717] dark:text-white border border-[#E5E5E5] dark:border-[#333] text-xs font-black rounded-xl transition-all shadow-xs"
                  >
                    <Download className="w-4 h-4 text-[#E31B23]" />
                    <span>Download Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl shadow-xs transition-all"
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartExport}
                  disabled={!summary || isGenerating || !isAuthorized || summary.totalActiveCustomers === 0}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl shadow-[0_6px_18px_rgba(227,27,35,0.18)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-98"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Dossier...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>Generate PDF ({(summary?.totalActiveCustomers || 0) * 2} Pages · 2 per Customer)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
