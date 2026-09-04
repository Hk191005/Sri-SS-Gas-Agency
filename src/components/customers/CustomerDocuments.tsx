import React, { useState, useEffect } from 'react';
import type { CustomerDocument, DocumentType } from '../../types/database.types';
import { getCustomerDocuments, uploadCustomerDocument, deleteCustomerDocument } from '../../lib/db';
import { FileText, Shield, Upload, Trash2, ExternalLink, AlertCircle, Lock } from 'lucide-react';

interface CustomerDocumentsProps {
  customerId: string;
}

export const CustomerDocuments: React.FC<CustomerDocumentsProps> = ({ customerId }) => {
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<'aadhaar' | 'other'>('aadhaar');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

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
    try {
      await uploadCustomerDocument(customerId, selectedFile, docType as DocumentType);
      setSelectedFile(null);
      await loadDocs();
    } catch (err: any) {
      setErrorMsg('Failed to upload document: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, path: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteCustomerDocument(docId, path);
      await loadDocs();
    } catch (e: any) {
      setErrorMsg('Failed to delete document');
    }
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
            All customer Aadhaar and verification documents are stored securely in a private Supabase Storage bucket (`customer-documents`). Files are accessed exclusively via authenticated signed temporary URLs. Documents are excluded from CSV exports and public dashboard views.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-white dark:bg-[#171717] p-4 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs space-y-3">
        <h4 className="text-xs font-black text-[#171717] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-[#E31B23]" /> Upload New Document
        </h4>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={docType}
            onChange={(e: any) => setDocType(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-xs font-semibold text-[#171717] dark:text-white"
          >
            <option value="aadhaar">Aadhaar Document</option>
            <option value="other">Other Document / License</option>
          </select>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
            className="flex-1 text-xs text-[#525252] dark:text-[#D4D4D4] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#FFF1F2] file:text-[#C9151C] hover:file:bg-[#FFD6D8]"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="px-4 py-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-black rounded-lg shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </form>

      {/* Documents List */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-between">
          <h4 className="text-xs font-black text-[#525252] uppercase tracking-wider">
            Uploaded Documents ({documents.length})
          </h4>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-[#737373]">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#737373] space-y-1">
            <FileText className="w-8 h-8 text-[#737373] mx-auto opacity-50" />
            <p className="font-black text-[#171717] dark:text-white">No documents uploaded yet</p>
            <p className="text-[#525252]">Upload customer Aadhaar card or business registration documents above.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F1F1] dark:divide-[#262626]">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    doc.document_type === 'aadhaar' ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60' : 'bg-[#FAFAFA] text-[#171717] border-[#E5E5E5]'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#171717] dark:text-white">{doc.original_filename}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                        doc.document_type === 'aadhaar' ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60' : 'bg-[#FAFAFA] text-[#525252] border-[#E5E5E5]'
                      }`}>
                        {doc.document_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      Uploaded on {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {doc.signed_url && (
                    <a
                      href={doc.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-white dark:bg-[#1F1F1F] hover:bg-[#FAFAFA] text-[#171717] dark:text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E31B23]" /> View Document
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id, doc.storage_path)}
                    className="p-1.5 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] rounded-lg transition-colors"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
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
