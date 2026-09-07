import React, { useState, useEffect } from 'react';
import type { CustomerDocument, DocumentType } from '../../types/database.types';
import { getCustomerDocuments, uploadCustomerDocument, deleteCustomerDocument } from '../../lib/db';
import { FileText, Shield, Upload, Trash2, ExternalLink, AlertCircle, Lock, Loader2, CheckCircle2 } from 'lucide-react';

interface CustomerDocumentsProps {
  customerId: string;
}

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'gst', label: 'GST Certificate' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'business_reg', label: 'Business Registration' },
  { value: 'license', label: 'License / Permit' },
  { value: 'other', label: 'Other Document' },
];

export const CustomerDocuments: React.FC<CustomerDocumentsProps> = ({ customerId }) => {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentType>('aadhaar');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await getCustomerDocuments(customerId);
      setDocuments(data);
    } catch (e: any) {
      setErrorMsg('Failed to fetch customer documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [customerId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;
    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await uploadCustomerDocument(customerId, selectedFile, docType);
      setSelectedFile(null);
      setSuccessMsg(`"${selectedFile.name}" uploaded successfully as ${DOCUMENT_TYPE_OPTIONS.find(o => o.value === docType)?.label || docType}!`);
      await loadDocs();
    } catch (err: any) {
      setErrorMsg('Failed to upload document: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: CustomerDocument) => {
    const docLabel = DOCUMENT_TYPE_OPTIONS.find(o => o.value === doc.document_type)?.label || doc.document_type;
    if (!window.confirm(`Are you sure you want to permanently delete "${doc.original_filename}" (${docLabel})?\n\nThis will remove the file from secure storage.`)) {
      return;
    }

    setDeletingId(doc.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await deleteCustomerDocument(doc.id, doc.storage_path);
      setSuccessMsg(`Document "${doc.original_filename}" removed successfully.`);
      await loadDocs();
    } catch (e: any) {
      setErrorMsg('Failed to delete document: ' + (e.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  const getDocBadge = (type: string) => {
    const matched = DOCUMENT_TYPE_OPTIONS.find(o => o.value === type);
    const label = matched ? matched.label : type;
    if (type === 'aadhaar') {
      return <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#F0FDF4] text-[#16A34A] border border-emerald-200/60">{label}</span>;
    }
    if (type === 'gst' || type === 'business_reg') {
      return <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#EFF6FF] text-[#2563EB] border border-blue-200/60">{label}</span>;
    }
    if (type === 'pan') {
      return <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#FAF5FF] text-[#9333EA] border border-purple-200/60">{label}</span>;
    }
    return <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#FAFAFA] dark:bg-[#262626] text-[#525252] dark:text-[#A3A3A3] border border-[#E5E5E5] dark:border-[#333]">{label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Aadhaar Security Banner */}
      <div className="bg-[#FAFAFA] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] p-4 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-start gap-3 shadow-xs">
        <Shield className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-black text-[#171717] dark:text-white flex items-center gap-1.5">
            Private Storage Vault <Lock className="w-3 h-3 text-[#16A34A]" />
          </h4>
          <p className="text-[#525252] dark:text-[#D4D4D4] leading-relaxed font-semibold">
            All customer verification documents (Aadhaar, GST, PAN, Address Proofs, Licenses) are stored securely in a private Supabase Storage bucket (`customer-documents`). Files are accessed exclusively via authenticated signed temporary URLs with zero public exposure.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-[#F0FDF4] border border-emerald-200 text-[#16A34A] text-xs rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload Form: UPLOAD NEW DOCUMENT */}
      <form onSubmit={handleUpload} className="bg-white dark:bg-[#171717] p-5 rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-[#E31B23]" /> Upload New Document
          </h4>
          <span className="text-[11px] font-semibold text-[#737373]">
            Supports PDF, JPG, JPEG, PNG, WEBP (Max 10MB)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
              Document Type *
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
              Select File *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                required
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="flex-1 text-xs text-[#525252] dark:text-[#D4D4D4] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FFF1F2] file:text-[#C9151C] hover:file:bg-[#FFD6D8]"
              />
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="px-5 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Documents List: EXISTING DOCUMENTS */}
      <div className="bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-between">
          <h4 className="text-xs font-black text-[#525252] dark:text-[#D4D4D4] uppercase tracking-wider flex items-center gap-2">
            <span>Existing Documents</span>
            <span className="text-[11px] bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] px-2.5 py-0.5 rounded-full font-black border border-[#FFD6D8] dark:border-red-900/40">
              {documents.length}
            </span>
          </h4>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#737373] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#E31B23]" />
            <span>Loading documents from storage vault...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#737373] space-y-2">
            <FileText className="w-10 h-10 text-[#737373] mx-auto opacity-40" />
            <p className="font-black text-[#171717] dark:text-white text-sm">No documents uploaded yet</p>
            <p className="text-[#525252] dark:text-[#A3A3A3] max-w-sm mx-auto">
              Upload customer Aadhaar card, PAN card, GST certificate, or other verification proofs above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F1F1] dark:divide-[#262626]">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    doc.document_type === 'aadhaar' ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60' :
                    doc.document_type === 'gst' || doc.document_type === 'business_reg' ? 'bg-[#EFF6FF] text-[#2563EB] border-blue-200/60' :
                    doc.document_type === 'pan' ? 'bg-[#FAF5FF] text-[#9333EA] border-purple-200/60' :
                    'bg-[#FAFAFA] dark:bg-[#262626] text-[#E31B23] border-[#E5E5E5] dark:border-[#333]'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#171717] dark:text-white truncate max-w-xs sm:max-w-md">
                        {doc.original_filename}
                      </span>
                      {getDocBadge(doc.document_type)}
                    </div>
                    <p className="text-[11px] text-[#737373] mt-1 font-medium">
                      Uploaded on {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {doc.signed_url ? (
                    <a
                      href={doc.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#FAFAFA] text-[#171717] dark:text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors shadow-2xs hover:border-[#E31B23]"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E31B23]" /> View / Download
                    </a>
                  ) : (
                    <span className="text-xs text-[#737373] font-bold px-3 py-1.5 bg-[#FAFAFA] rounded-lg border border-[#E5E5E5]">
                      Vault Protected
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="p-2 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-red-950/40 rounded-xl transition-colors disabled:opacity-50"
                    title="Delete Document"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#DC2626]" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
