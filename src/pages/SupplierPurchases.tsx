import React, { useState, useEffect } from 'react';
import {
  getSupplierPurchases,
  createSupplierPurchase,
  updateSupplierPurchase,
  deleteSupplierPurchase,
  cancelSupplierPurchase,
  addSupplierPayment,
  checkDuplicateInvoice,
  getSupplierCompanies,
  createSupplierCompany,
  uploadSupplierBillFile,
} from '../lib/supplierDb';
import {
  exportSupplierPurchasesExcel,
  exportSupplierPurchasesPdf,
  exportSupplierPurchasesCsv,
} from '../lib/supplierExport';
import { getCylinderTypes, isValidUUID } from '../lib/db';
import { analyzeSupplierBill, type ExtractedBillData } from '../lib/ocr';
import type { SupplierPurchase, CylinderType, SupplierCompany } from '../types/database.types';
import { useToast } from '../context/ToastContext';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Building2,
  X,
  FileCheck,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Pencil,
  AlertCircle,
  Ban,
  Download,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';

interface PurchaseLineItem {
  cylinder_type_id: string;
  sizeLabel: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export const SupplierPurchases: React.FC = () => {
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [supplierCompanies, setSupplierCompanies] = useState<SupplierCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'draft' | 'cancelled'>('all');

  const { showSuccess, showError } = useToast();

  // Create Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('upload');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<SupplierPurchase | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<SupplierPurchase | null>(null);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editTaxAmount, setEditTaxAmount] = useState<number | ''>(0);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<PurchaseLineItem[]>([]);

  // Delete / Void Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState<SupplierPurchase | null>(null);

  // Export State
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Bill Entry Form State
  const [uploadStep, setUploadStep] = useState<'select' | 'analyzing' | 'review'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedBillData | null>(null);
  const [supplierName, setSupplierName] = useState('SUPERGAS');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierGstin, setNewSupplierGstin] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxAmount, setTaxAmount] = useState<number | ''>(0);
  const [amountPaid, setAmountPaid] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseLineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Payment Modal State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'upi' | 'cash' | 'other'>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [list, cTypes, companies] = await Promise.all([
        getSupplierPurchases(),
        getCylinderTypes(),
        getSupplierCompanies(),
      ]);
      setPurchases(list);
      setCylinderTypes(cTypes);
      setSupplierCompanies(companies);
      if (companies.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(companies[0].id);
        setSupplierName(companies[0].company_name);
      }
    } catch (e: any) {
      console.error('Failed to load supplier purchases:', e);
      setLoadError(e.message || 'Failed to load supplier purchases from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getBuyingPriceForCylinder = (ct: CylinderType): number => {
    if (ct.default_buying_price !== undefined && ct.default_buying_price > 0) {
      return ct.default_buying_price;
    }
    switch (Math.round(ct.weight_kg)) {
      case 4:
        return 600;
      case 12:
        return 1625;
      case 17:
        return 2380;
      case 21:
        return 2940;
      default:
        return 1625;
    }
  };

  // Initialize a default manual line item from loaded cylinder types
  const createDefaultLineItem = (types: CylinderType[]): PurchaseLineItem => {
    const firstType = types.length > 0 ? types[0] : null;
    const bp = firstType ? getBuyingPriceForCylinder(firstType) : 600;
    return {
      cylinder_type_id: firstType ? firstType.id : '',
      sizeLabel: firstType ? firstType.name : '4 kg Domestic',
      quantity: 20,
      unit_price: bp,
      total_price: 20 * bp,
    };
  };

  const openModal = (mode: 'upload' | 'manual') => {
    setEntryMode(mode);
    setUploadStep(mode === 'upload' ? 'select' : 'review');
    setSelectedFile(null);
    setExtractError('');
    setDuplicateWarning('');
    setInvoiceNumber(mode === 'manual' ? `INV-${Date.now().toString().slice(-4)}` : '');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setTaxAmount(0);
    setIsAddingNewSupplier(false);

    if (supplierCompanies.length > 0) {
      setSelectedCompanyId(supplierCompanies[0].id);
      setSupplierName(supplierCompanies[0].company_name);
    } else {
      setSelectedCompanyId('');
      setSupplierName('SUPERGAS');
    }

    if (mode === 'manual') {
      setItems([createDefaultLineItem(cylinderTypes)]);
    } else {
      setItems([]);
    }

    setIsPurchaseModalOpen(true);
  };

  // Line item manipulation
  const handleAddLineItem = () => {
    setItems((prev) => [...prev, createDefaultLineItem(cylinderTypes)]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCylinderTypeSelect = (index: number, cylinderTypeId: string) => {
    const matched = cylinderTypes.find((ct) => ct.id === cylinderTypeId);
    if (!matched) return;

    const bp = getBuyingPriceForCylinder(matched);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        cylinder_type_id: matched.id,
        sizeLabel: matched.name,
        unit_price: bp,
        total_price: (Number(copy[index].quantity) || 0) * bp,
      };
      return copy;
    });
  };

  const handleUpdateItem = (index: number, field: 'quantity' | 'unit_price', val: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: val };
      target.total_price = (Number(target.quantity) || 0) * (Number(target.unit_price) || 0);
      updated[index] = target;
      return updated;
    });
  };

  // -------------------------------------------------------------
  // EDIT PURCHASE HANDLERS
  // -------------------------------------------------------------
  const openEditModal = (p: SupplierPurchase) => {
    setEditingPurchase(p);
    setEditSupplierName(p.supplier_name);
    setEditCompanyId(p.supplier_company_id || '');
    setEditInvoiceNumber(p.invoice_number);
    setEditInvoiceDate(p.invoice_date || new Date().toISOString().split('T')[0]);
    setEditTaxAmount(p.tax_amount || 0);
    setEditNotes(p.notes || '');

    // Populate line items with exact historical snapshot unit_price
    const mappedItems: PurchaseLineItem[] =
      p.items && p.items.length > 0
        ? p.items.map((it) => {
            const found = cylinderTypes.find((ct) => ct.id === it.cylinder_type_id);
            return {
              cylinder_type_id: it.cylinder_type_id,
              sizeLabel: found ? found.name : 'Cylinder',
              quantity: it.quantity,
              unit_price: Number(it.unit_price), // CRITICAL: PRESERVE EXACT HISTORICAL PRICE
              total_price: Number(it.total_price || it.quantity * it.unit_price),
            };
          })
        : [createDefaultLineItem(cylinderTypes)];

    setEditItems(mappedItems);
    setIsEditModalOpen(true);
  };

  const handleEditAddLineItem = () => {
    setEditItems((prev) => [...prev, createDefaultLineItem(cylinderTypes)]);
  };

  const handleEditRemoveLineItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditCylinderTypeSelect = (index: number, cylinderTypeId: string) => {
    const matched = cylinderTypes.find((ct) => ct.id === cylinderTypeId);
    if (!matched) return;

    const bp = getBuyingPriceForCylinder(matched);
    setEditItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        cylinder_type_id: matched.id,
        sizeLabel: matched.name,
        unit_price: bp,
        total_price: (Number(copy[index].quantity) || 0) * bp,
      };
      return copy;
    });
  };

  const handleEditUpdateItem = (index: number, field: 'quantity' | 'unit_price', val: number) => {
    setEditItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: val };
      target.total_price = (Number(target.quantity) || 0) * (Number(target.unit_price) || 0);
      updated[index] = target;
      return updated;
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase || submitting) return;

    if (editItems.length === 0) {
      showError('Please add at least one cylinder line item.');
      return;
    }

    if (editItems.some((it) => !it.cylinder_type_id || !isValidUUID(it.cylinder_type_id))) {
      showError('Please select a valid cylinder type for every line item.');
      return;
    }

    if (editItems.some((it) => it.quantity <= 0 || isNaN(it.quantity))) {
      showError('All cylinder quantities must be positive integers (1 or greater).');
      return;
    }

    if (editItems.some((it) => it.unit_price < 0 || isNaN(it.unit_price))) {
      showError('Cylinder unit buying prices cannot be negative.');
      return;
    }

    const editSubtotal = editItems.reduce((acc, it) => acc + (it.total_price || 0), 0);
    const editTotal = editSubtotal + Number(editTaxAmount || 0);
    const paidAmount = Number(editingPurchase.amount_paid || 0);

    if (editTotal < paidAmount) {
      showError(`Purchase total (₹${editTotal.toLocaleString('en-IN')}) cannot be lower than the amount already paid (₹${paidAmount.toLocaleString('en-IN')}).`);
      return;
    }

    setSubmitting(true);
    try {
      await updateSupplierPurchase({
        id: editingPurchase.id,
        supplier_name: editSupplierName.trim(),
        supplier_company_id: editCompanyId || null,
        invoice_number: editInvoiceNumber.trim(),
        invoice_date: editInvoiceDate,
        tax_amount: Number(editTaxAmount || 0),
        notes: editNotes.trim() || undefined,
        items: editItems.map((it) => ({
          cylinder_type_id: it.cylinder_type_id,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          tax_amount: 0,
          total_price: Number(it.quantity) * Number(it.unit_price),
        })),
      });

      setIsEditModalOpen(false);
      setEditingPurchase(null);
      await loadData();
      showSuccess('Supplier purchase updated successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to update supplier purchase');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // DELETE / VOID PURCHASE HANDLERS
  // -------------------------------------------------------------
  const openDeleteModal = (p: SupplierPurchase) => {
    setDeletingPurchase(p);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPurchase || submitting) return;
    setSubmitting(true);
    try {
      await deleteSupplierPurchase(deletingPurchase.id);
      setIsDeleteModalOpen(false);
      setDeletingPurchase(null);
      await loadData();
      showSuccess('Supplier purchase deleted successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to delete supplier purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!deletingPurchase || submitting) return;
    setSubmitting(true);
    try {
      await cancelSupplierPurchase(deletingPurchase.id, 'Voided by administrator');
      setIsDeleteModalOpen(false);
      setDeletingPurchase(null);
      await loadData();
      showSuccess('Supplier purchase cancelled / voided successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to cancel supplier purchase');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Purchases
  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      p.purchase_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Totals calculations
  const totalPurchasesMonth = purchases.reduce((sum, p) => sum + p.total_amount, 0);
  const totalPaidMonth = purchases.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalOutstandingPayable = purchases.reduce((sum, p) => sum + p.outstanding_amount, 0);

  const subtotal = items.reduce((sum, it) => sum + it.total_price, 0);
  const totalAmount = subtotal + Number(taxAmount || 0);

  // Upload & File Drop Handler
  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setUploadStep('analyzing');
    setExtractError('');
    setDuplicateWarning('');

    try {
      const extracted: ExtractedBillData = await analyzeSupplierBill(file);
      setExtractedData(extracted);

      // Build editable items array using loaded cylinder types with Buying Price
      const mappedItems: PurchaseLineItem[] = extracted.items.map((it) => {
        const found = cylinderTypes.find((ct) => ct.name.toLowerCase().includes(it.cylinder_size.toLowerCase()));
        const resolvedUnitPrice = it.unit_price > 0 ? it.unit_price : (found?.default_buying_price || 600);
        return {
          cylinder_type_id: found ? found.id : cylinderTypes[0]?.id || '',
          sizeLabel: it.cylinder_size,
          quantity: Math.max(1, it.quantity),
          unit_price: resolvedUnitPrice,
          total_price: Math.max(1, it.quantity) * resolvedUnitPrice,
        };
      });

      if (mappedItems.length === 0 && cylinderTypes.length > 0) {
        mappedItems.push(createDefaultLineItem(cylinderTypes));
      }

      const extractedSuppName = extracted.supplier_name.value.trim();
      const extractedInvNum = extracted.invoice_number.value.trim();
      const extractedInvDate = extracted.invoice_date.value || new Date().toISOString().split('T')[0];
      const extractedTax = extracted.tax_amount.value || 0;

      if (extractedSuppName) {
        setSupplierName(extractedSuppName);
        // Check if supplier exists in existing companies
        const matchedComp = supplierCompanies.find(
          (c) => c.company_name.toLowerCase() === extractedSuppName.toLowerCase()
        );
        if (matchedComp) {
          setSelectedCompanyId(matchedComp.id);
        } else {
          setSelectedCompanyId('');
          setIsAddingNewSupplier(true);
        }
      }

      if (extracted.supplier_gstin?.value) {
        setNewSupplierGstin(extracted.supplier_gstin.value);
      }

      setInvoiceNumber(extractedInvNum);
      setInvoiceDate(extractedInvDate);
      setTaxAmount(extractedTax);
      setItems(mappedItems);

      // Check duplicate invoice detection
      if (extractedInvNum && (extractedSuppName || supplierName)) {
        const checkName = extractedSuppName || supplierName;
        const isDuplicate = await checkDuplicateInvoice(checkName, extractedInvNum);
        if (isDuplicate) {
          setDuplicateWarning(`Invoice #${extractedInvNum} from ${checkName} is already recorded in the system!`);
        }
      }

      setUploadStep('review');
    } catch (e: any) {
      console.error('OCR Extraction failed:', e);
      setExtractError(e.message || 'Failed to extract text from bill image');
      setUploadStep('select');
    }
  };

  // Confirm and save purchase (Common service for both Manual Entry and OCR Review)
  const handleConfirmSupplierPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (items.length === 0) {
      showError('Please add at least one cylinder line item.');
      return;
    }

    if (items.some((it) => !it.cylinder_type_id || !isValidUUID(it.cylinder_type_id))) {
      showError('Please select a valid cylinder type for every line item.');
      return;
    }

    if (items.some((it) => it.quantity <= 0 || isNaN(it.quantity))) {
      showError('All cylinder quantities must be positive integers (1 or greater).');
      return;
    }

    if (items.some((it) => it.unit_price < 0 || isNaN(it.unit_price))) {
      showError('Cylinder unit buying prices cannot be negative.');
      return;
    }

    const finalSupplierName = supplierName.trim();
    let finalCompanyId = selectedCompanyId;

    setSubmitting(true);
    try {
      // 1. Create supplier company if adding new
      if (isAddingNewSupplier && finalSupplierName) {
        try {
          const newComp = await createSupplierCompany({
            company_name: finalSupplierName,
            contact_person: newSupplierContact.trim() || undefined,
            phone: newSupplierPhone.trim() || undefined,
            gstin: newSupplierGstin.trim() || undefined,
          });
          finalCompanyId = newComp.id;
        } catch (compErr: any) {
          console.warn('Company creation notice:', compErr.message);
        }
      }

      // 2. Upload file if present (OCR mode)
      let storagePath: string | undefined = undefined;
      if (selectedFile) {
        try {
          storagePath = await uploadSupplierBillFile(selectedFile);
        } catch (e) {
          console.warn('Bill upload notice:', e);
        }
      }

      // 3. Common Purchase Creation Service
      await createSupplierPurchase({
        supplier_name: finalSupplierName,
        supplier_company_id: finalCompanyId || undefined,
        purchase_source: entryMode === 'manual' ? 'manual' : 'ocr_upload',
        invoice_number: invoiceNumber.trim() || `MAN-${Date.now().toString().slice(-6)}`,
        invoice_date: invoiceDate,
        subtotal: subtotal,
        tax_amount: Number(taxAmount || 0),
        total_amount: totalAmount,
        amount_paid: Number(amountPaid || 0),
        notes: notes.trim() || undefined,
        bill_storage_path: storagePath,
        status: 'confirmed',
        items: items.map((i) => ({
          cylinder_type_id: i.cylinder_type_id,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          total_price: Number(i.quantity * i.unit_price),
        })),
        extraction_info: selectedFile
          ? {
              file_name: selectedFile.name,
              extracted_at: new Date().toISOString(),
            }
          : undefined,
      });

      setIsPurchaseModalOpen(false);
      await loadData();
      showSuccess('Supplier gas purchase saved successfully!');
    } catch (err: any) {
      showError(err.message || 'Failed to save supplier purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase || submitting) return;
    if (paymentAmount <= 0) {
      showError('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      await addSupplierPayment({
        supplier_purchase_id: selectedPurchase.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: paymentNotes,
      });

      setIsPaymentModalOpen(false);
      setSelectedPurchase(null);
      await loadData();
      showSuccess('Supplier payment recorded successfully!');
    } catch (err: any) {
      showError(err.message || 'Failed to record supplier payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Export Handler (Respects active search and status filter)
  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    setIsExportDropdownOpen(false);

    if (filteredPurchases.length === 0) {
      showError('No supplier purchases available to export.');
      return;
    }

    try {
      const filterInfo = {
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };

      if (format === 'excel') {
        exportSupplierPurchasesExcel(filteredPurchases, cylinderTypes, filterInfo);
      } else if (format === 'pdf') {
        exportSupplierPurchasesPdf(filteredPurchases, cylinderTypes, filterInfo);
      } else if (format === 'csv') {
        exportSupplierPurchasesCsv(filteredPurchases, cylinderTypes, filterInfo);
      }

      showSuccess('Supplier purchase export generated successfully');
    } catch (err: any) {
      console.error('Export error:', err);
      showError(err.message || 'Failed to generate export');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-[#E31B23]" />
            <span>Supplier Stock Purchases</span>
          </h1>
          <p className="text-sm font-medium text-[#525252] dark:text-[#A3A3A3] mt-0.5">
            Manage company stock purchases (SUPERGAS), bill OCR extractions, manual intake & inventory inflows
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Export Dropdown Menu (Secondary Button) */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] text-[#171717] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-2xs transition-all active:scale-98 shrink-0 min-h-[44px]"
              title="Export Supplier Purchases"
              aria-label="Export Supplier Purchases"
            >
              <Download className="w-4 h-4 text-[#E31B23]" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsExportDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl shadow-xl z-30 py-1.5 text-xs font-bold overflow-hidden animate-in fade-in duration-150">
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#262626] flex items-center gap-2.5 text-[#171717] dark:text-white transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="block font-bold">Export as Excel (.xlsx)</span>
                      <span className="block text-xs text-[#737373] dark:text-[#A3A3A3] font-normal">Summary, Items & Payments</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#262626] flex items-center gap-2.5 text-[#171717] dark:text-white transition-colors border-t border-[#F1F1F1] dark:border-[#262626]"
                  >
                    <FileText className="w-4 h-4 text-[#E31B23] shrink-0" />
                    <div>
                      <span className="block font-bold">Export as PDF (.pdf)</span>
                      <span className="block text-xs text-[#737373] dark:text-[#A3A3A3] font-normal">Official Formatted Ledger</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#262626] flex items-center gap-2.5 text-[#171717] dark:text-white transition-colors border-t border-[#F1F1F1] dark:border-[#262626]"
                  >
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <span className="block font-bold">Export as CSV (.csv)</span>
                      <span className="block text-xs text-[#737373] dark:text-[#A3A3A3] font-normal">Detailed Line-Item Ledger</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Secondary Action: Upload Bill (OCR) */}
          <button
            onClick={() => openModal('upload')}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] text-[#171717] dark:text-white border border-[#E5E7EB] dark:border-[#2A2A2A] font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xs transition-all active:scale-98 shrink-0 min-h-[44px]"
            aria-label="Upload Bill using OCR"
          >
            <Upload className="w-4 h-4 text-[#E31B23]" />
            <span>Upload Bill (OCR)</span>
          </button>

          {/* Primary Action: Manual Entry (Visually Dominant) */}
          <button
            onClick={() => openModal('manual')}
            className="flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-[0_4px_14px_rgba(227,27,35,0.16)] transition-all active:scale-98 shrink-0 min-h-[44px]"
            aria-label="Add Supplier Purchase Manual Entry"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Tight Vertical Spacing, Title Case, 12px Subtitles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold text-[#525252] dark:text-[#A3A3A3]">Total Stock Purchases</span>
            <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] border border-[#FECDD3] dark:border-red-900/40 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#171717] dark:text-white tracking-tight">₹{totalPurchasesMonth.toLocaleString('en-IN')}</p>
          <span className="text-xs font-medium text-[#737373] dark:text-[#A3A3A3] mt-1 block">{purchases.length} supplier invoices recorded</span>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold text-[#525252] dark:text-[#A3A3A3]">Supplier Payments Paid</span>
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#059669] dark:text-emerald-400 tracking-tight">₹{totalPaidMonth.toLocaleString('en-IN')}</p>
          <span className="text-xs font-medium text-[#737373] dark:text-[#A3A3A3] mt-1 block">Paid against company invoices</span>
        </div>

        <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-bold text-[#525252] dark:text-[#A3A3A3]">Supplier Outstanding</span>
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706] border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#D97706] dark:text-amber-400 tracking-tight">₹{totalOutstandingPayable.toLocaleString('en-IN')}</p>
          <span className="text-xs font-medium text-[#737373] dark:text-[#A3A3A3] mt-1 block">Pending company invoice balance</span>
        </div>
      </div>

      {/* Filter & View Controls (Cohesive Grouped Row) */}
      <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] p-3.5 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, supplier..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20 focus:border-[#E31B23] font-semibold transition-all min-h-[44px]"
            />
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-[#F9FAFB] dark:bg-[#1F1F1F] border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs text-[#171717] dark:text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E31B23]/20 focus:border-[#E31B23] font-bold transition-all min-h-[44px]"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      {loading ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] text-xs font-semibold text-[#737373]">
          Loading supplier invoices & intake ledger...
        </div>
      ) : loadError ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-8 text-center rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold text-red-600 dark:text-red-400 text-sm">Failed to load supplier records</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">{loadError}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#E31B23] text-white text-xs font-bold rounded-xl hover:bg-[#C9151C] transition-colors min-h-[44px]"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="saas-card bg-white dark:bg-[#171717] p-12 text-center rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-3">
          <Building2 className="w-10 h-10 text-[#737373] mx-auto" />
          <p className="font-black text-[#171717] dark:text-white text-sm">No supplier purchases recorded yet</p>
          <p className="text-xs font-medium text-[#525252] dark:text-[#A3A3A3]">
            Click "Upload Bill (OCR)" or "Manual Entry" to record your first stock purchase.
          </p>
        </div>
      ) : (
        <div className="saas-card bg-white dark:bg-[#171717] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border-b border-[#E5E7EB] dark:border-[#2A2A2A] font-bold text-[#525252] dark:text-[#A3A3A3] text-xs">
                  <th className="py-3.5 px-4 font-bold">Purchase Code</th>
                  <th className="py-3.5 px-4 font-bold">Supplier / Invoice</th>
                  <th className="py-3.5 px-4 font-bold">Source</th>
                  <th className="py-3.5 px-4 font-bold">Date</th>
                  <th className="py-3.5 px-4 font-bold">Total Amount</th>
                  <th className="py-3.5 px-4 font-bold">Paid</th>
                  <th className="py-3.5 px-4 font-bold">Outstanding</th>
                  <th className="py-3.5 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1F1] dark:divide-[#262626] text-[#171717] dark:text-[#F5F5F5]">
                {filteredPurchases.map((p) => {
                  const isManual = p.purchase_source === 'manual' || (!p.purchase_source && !p.bill_storage_path);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-black text-[#E31B23]">{p.purchase_code}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#171717] dark:text-white block">{p.supplier_name}</span>
                        <span className="text-xs font-mono text-[#737373] dark:text-[#A3A3A3]">Invoice #{p.invoice_number}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isManual ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#F3F4F6] dark:bg-[#262626] text-[#4B5563] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#374151]">
                            MANUAL
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-blue-200/60">
                            OCR UPLOAD
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium">{p.invoice_date}</td>
                      <td className="py-3.5 px-4 font-black text-[#171717] dark:text-white">₹{p.total_amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-bold text-[#16A34A] dark:text-emerald-400">₹{p.amount_paid.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-bold text-[#D97706] dark:text-amber-400">₹{p.outstanding_amount.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-2 text-[#525252] dark:text-[#A3A3A3] hover:text-[#E31B23] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#262626] rounded-lg transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Edit Purchase"
                            aria-label="Edit Purchase"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(p)}
                            className="p-2 text-[#737373] hover:text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-rose-950/40 rounded-lg transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Delete Purchase"
                            aria-label="Delete Purchase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {p.outstanding_amount > 0 && p.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setSelectedPurchase(p);
                                setPaymentAmount(p.outstanding_amount);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-[#FFF1F2] dark:bg-rose-950/30 text-[#C9151C] dark:text-red-400 hover:bg-[#E31B23] hover:text-white rounded-lg border border-[#FECDD3] dark:border-red-900/40 font-bold text-xs transition-all shrink-0 ml-1 min-h-[36px]"
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Supplier Purchase Modal: Upload Bill (OCR) & Manual Entry */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl modal-enter my-8">
            {/* Modal Header with Mode Switcher */}
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] flex items-center justify-center border border-[#FECDD3] dark:border-red-900/40">
                  {entryMode === 'upload' ? <Upload className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-base font-black text-[#171717] dark:text-white">
                    {entryMode === 'upload' ? 'Upload Supplier Bill (OCR)' : 'Manual Supplier Purchase Entry'}
                  </h2>
                  <p className="text-xs text-[#737373] dark:text-[#A3A3A3] mt-0.5">
                    {entryMode === 'upload'
                      ? 'Scan bill image/PDF to auto-extract invoice details and line items'
                      : 'Enter supplier stock purchase with authorized buying prices and inventory inflow'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#262626] transition-colors"
                aria-label="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-[#F3F4F6] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => {
                  setEntryMode('upload');
                  setUploadStep('select');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  entryMode === 'upload'
                    ? 'bg-white dark:bg-[#2A2A2A] text-[#171717] dark:text-white shadow-xs'
                    : 'text-[#737373] hover:text-[#171717] dark:hover:text-white'
                }`}
              >
                Upload Bill (OCR)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode('manual');
                  setUploadStep('review');
                  if (items.length === 0) {
                    setItems([createDefaultLineItem(cylinderTypes)]);
                  }
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  entryMode === 'manual'
                    ? 'bg-white dark:bg-[#2A2A2A] text-[#171717] dark:text-white shadow-xs'
                    : 'text-[#737373] hover:text-[#171717] dark:hover:text-white'
                }`}
              >
                Manual Line-Item Entry
              </button>
            </div>

            {/* Upload Step 1: Select File */}
            {entryMode === 'upload' && uploadStep === 'select' && (
              <div className="space-y-4">
                {extractError && (
                  <div className="p-3 bg-[#FFF1F2] dark:bg-rose-950/30 border border-[#FECDD3] dark:border-rose-900/50 text-[#DC2626] dark:text-rose-400 font-bold rounded-xl flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{extractError}</span>
                  </div>
                )}

                <div className="border-2 border-dashed border-[#D6D6D6] dark:border-[#3A3A3A] bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-2xl p-8 text-center space-y-3">
                  <FileCheck className="w-12 h-12 text-[#E31B23] mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-[#171717] dark:text-white">Upload Supplier Bill Image or PDF</p>
                    <p className="text-xs text-[#737373] dark:text-[#A3A3A3] mt-0.5">Supports JPG, PNG, and PDF format invoices</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelected(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    id="supplier-bill-upload-input"
                  />
                  <label
                    htmlFor="supplier-bill-upload-input"
                    className="inline-flex items-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-[0_4px_14px_rgba(227,27,35,0.16)] min-h-[44px]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select Invoice File</span>
                  </label>
                </div>
              </div>
            )}

            {/* Upload Step 2: Analyzing */}
            {entryMode === 'upload' && uploadStep === 'analyzing' && (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-10 h-10 text-[#E31B23] animate-spin mx-auto" />
                <p className="text-sm font-bold text-[#171717] dark:text-white">Extracting invoice details via OCR...</p>
                <p className="text-xs text-[#737373] dark:text-[#A3A3A3]">Analyzing cylinder sizes (4 kg, 12 kg, 17 kg, 21 kg), quantities, and tax</p>
              </div>
            )}

            {/* Common Form: Review / Manual Entry Form */}
            {uploadStep === 'review' && (
              <form onSubmit={handleConfirmSupplierPurchase} className="space-y-4 text-xs font-semibold">
                {/* Document Type Detection & Confidence Header Banner (For OCR Upload Mode) */}
                {entryMode === 'upload' && extractedData && (
                  <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                            extractedData.document_type === 'supplier_tax_invoice'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                              : extractedData.document_type === 'supplier_dc_memo'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                          }`}
                        >
                          {extractedData.document_type_label}
                        </span>
                        <span className="text-[11px] font-bold text-[#737373]">
                          {Math.round(extractedData.document_type_confidence * 100)}% detection confidence
                        </span>
                      </div>

                      {/* Confidence Score Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          extractedData.overall_level === 'HIGH'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                            : extractedData.overall_level === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200'
                        }`}
                      >
                        Confidence: {extractedData.overall_level} ({Math.round(extractedData.overall_confidence * 100)}%)
                      </span>
                    </div>

                    {extractedData.document_type === 'unknown' ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Document type could not be confidently identified. Please review and fill required fields manually.</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#737373] dark:text-[#A3A3A3]">
                        {extractedData.message || 'Please review and adjust extracted fields below before confirming.'}
                      </p>
                    )}
                  </div>
                )}

                {duplicateWarning && (
                  <div className="p-3 bg-[#FFF1F2] dark:bg-rose-950/30 border border-[#FECDD3] dark:border-rose-900/50 text-[#DC2626] dark:text-rose-400 font-bold rounded-xl flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{duplicateWarning}</span>
                  </div>
                )}

                {/* Section 1: Supplier Company Selection */}
                <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#171717] dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#E31B23]" />
                      <span>Supplier Company</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
                      className="text-xs font-bold text-[#E31B23] hover:underline flex items-center gap-1"
                    >
                      {isAddingNewSupplier ? 'Select Existing Company' : '+ Add Supplier Company'}
                    </button>
                  </div>

                  {isAddingNewSupplier ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-1">Company Name</label>
                        <input
                          type="text"
                          required
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder="e.g. SUPERGAS Plant #2"
                          className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-1">Contact Person</label>
                        <input
                          type="text"
                          value={newSupplierContact}
                          onChange={(e) => setNewSupplierContact(e.target.value)}
                          placeholder="e.g. Logistics Executive"
                          className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={newSupplierPhone}
                          onChange={(e) => setNewSupplierPhone(e.target.value)}
                          placeholder="e.g. +91 9876500000"
                          className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-1">GSTIN Number</label>
                        <input
                          type="text"
                          value={newSupplierGstin}
                          onChange={(e) => setNewSupplierGstin(e.target.value)}
                          placeholder="e.g. 33AAAAA0000A1Z5"
                          className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                        />
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedCompanyId || supplierName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCompanyId(val);
                        const matched = supplierCompanies.find((c) => c.id === val || c.company_name === val);
                        if (matched) {
                          setSupplierName(matched.company_name);
                        } else {
                          setSupplierName(val);
                        }
                      }}
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                    >
                      {supplierCompanies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.company_name} {comp.gstin ? `(${comp.gstin})` : ''}
                        </option>
                      ))}
                      {!supplierCompanies.some((c) => c.id === selectedCompanyId || c.company_name === supplierName) && (
                        <option value={supplierName}>{supplierName}</option>
                      )}
                    </select>
                  )}
                </div>

                {/* Section 2: Invoice Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                      Invoice / Bill Number {entryMode === 'manual' ? '(Optional)' : '*'}
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. SUP-2026-0042"
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                      Purchase Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                    />
                  </div>
                </div>

                {/* Section 3: Cylinder Line Items */}
                <div className="space-y-2.5 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#171717] dark:text-white block">
                        Cylinder Stock Line Items (Buying Acquisition Cost)
                      </span>
                      <span className="text-xs text-[#737373] dark:text-[#A3A3A3]">
                        Select cylinder type to auto-fill authorized buying rate, or override price.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3 py-1.5 bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] hover:bg-[#E31B23] hover:text-white rounded-lg border border-[#FECDD3] dark:border-red-900/40 font-bold text-xs transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Cylinder Line</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]"
                      >
                        {/* Cylinder Type Select */}
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-0.5">Cylinder Type</label>
                          <select
                            value={item.cylinder_type_id || (cylinderTypes[0]?.id ?? '')}
                            onChange={(e) => handleCylinderTypeSelect(idx, e.target.value)}
                            className="w-full p-2 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                          >
                            {cylinderTypes.map((ct) => (
                              <option key={ct.id} value={ct.id}>
                                {ct.name} (₹{getBuyingPriceForCylinder(ct)})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-20">
                          <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-0.5 text-center">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                            className="w-full p-2 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-center font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                          />
                        </div>

                        {/* Buying Price / Unit */}
                        <div className="w-28">
                          <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-0.5">Buying Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-center font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-28 text-right pr-2">
                          <label className="block text-xs font-bold text-[#737373] dark:text-[#A3A3A3] mb-0.5">Line Total</label>
                          <span className="font-bold text-xs text-[#171717] dark:text-white block py-2">
                            ₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Delete Button */}
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-2 text-[#9CA3AF] hover:text-[#DC2626] rounded-lg mt-3"
                            title="Remove line"
                            aria-label="Remove cylinder line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Financial Adjustments & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                      GST Tax Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                      Amount Paid Upfront (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                      Notes / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Delivery truck #TN38-1234"
                      className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Section 5: Financial Summary */}
                <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-1.5 text-xs font-bold">
                  <div className="flex justify-between text-[#737373] dark:text-[#A3A3A3]">
                    <span>Subtotal:</span>
                    <span className="font-bold text-[#171717] dark:text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {Number(taxAmount) > 0 && (
                    <div className="flex justify-between text-[#737373] dark:text-[#A3A3A3]">
                      <span>GST Tax:</span>
                      <span className="font-bold text-[#171717] dark:text-white">+₹{Number(taxAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#171717] dark:text-white text-sm pt-1 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                    <span>Total Purchase Payable:</span>
                    <span className="text-[#E31B23] font-black">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
                  {entryMode === 'upload' && (
                    <button
                      type="button"
                      onClick={() => setUploadStep('select')}
                      className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4] rounded-xl font-bold text-xs min-h-[44px]"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4] rounded-xl font-bold text-xs min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-xl font-black text-xs shadow-[0_4px_14px_rgba(227,27,35,0.16)] flex items-center gap-1.5 min-h-[44px] transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Saving Stock...' : 'Confirm Stock Intake'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Supplier Payment Modal */}
      {isPaymentModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 backdrop-enter">
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl modal-enter">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <h2 className="text-base font-black text-[#171717] dark:text-white">Record Supplier Payment</h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#262626]"
                aria-label="Close Payment Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPaymentSubmit} className="space-y-3 text-xs font-semibold">
              <div className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-1">
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-xs">Invoice #{selectedPurchase.invoice_number} ({selectedPurchase.supplier_name})</span>
                <span className="font-black text-[#171717] dark:text-white text-sm">
                  Outstanding: ₹{selectedPurchase.outstanding_amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedPurchase.outstanding_amount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="cash">Cash</option>
                  <option value="other">Cheque / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. UTR #1234567890"
                  className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4] rounded-xl font-bold text-xs min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-xl font-black text-xs shadow-[0_4px_14px_rgba(227,27,35,0.16)] min-h-[44px] transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Purchase Modal */}
      {isEditModalOpen && editingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl modal-enter my-8">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] flex items-center justify-center border border-[#FECDD3] dark:border-red-900/40">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-[#171717] dark:text-white">Edit Supplier Purchase</h2>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E31B23] dark:text-red-400 border border-[#FECDD3] dark:border-red-900/40">
                      {editingPurchase.purchase_code}
                    </span>
                  </div>
                  <p className="text-xs text-[#737373] dark:text-[#A3A3A3] mt-0.5">
                    Modify supplier details, invoice metadata, cylinder line items, or buying rates
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPurchase(null);
                }}
                className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#262626]"
                aria-label="Close Edit Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Readonly info / Existing payments badge */}
            {editingPurchase.amount_paid > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-amber-800 dark:text-amber-300 font-semibold">
                    Payments recorded: <strong className="font-black text-[#171717] dark:text-white">₹{editingPurchase.amount_paid.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Total cannot be reduced below ₹{editingPurchase.amount_paid.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                    Supplier Company
                  </label>
                  <select
                    value={editCompanyId}
                    onChange={(e) => {
                      setEditCompanyId(e.target.value);
                      const matched = supplierCompanies.find((c) => c.id === e.target.value);
                      if (matched) setEditSupplierName(matched.company_name);
                    }}
                    className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                  >
                    {supplierCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.gstin || 'No GSTIN'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                    Tax / GST Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editTaxAmount}
                    onChange={(e) => setEditTaxAmount(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-bold text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4]">
                    Cylinder Line Items & Buying Rates
                  </label>
                  <button
                    type="button"
                    onClick={handleEditAddLineItem}
                    className="flex items-center gap-1 text-[#E31B23] hover:text-[#C9151C] font-bold text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Cylinder Type</span>
                  </button>
                </div>

                <div className="space-y-2 border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F]">
                  {editItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-12 sm:col-span-4">
                        <select
                          value={item.cylinder_type_id}
                          onChange={(e) => handleEditCylinderTypeSelect(index, e.target.value)}
                          className="w-full p-2 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                        >
                          {cylinderTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <div className="flex items-center gap-1 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg px-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleEditUpdateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full py-2 bg-transparent font-bold text-xs text-[#171717] dark:text-white focus:outline-none text-right"
                          />
                          <span className="text-xs font-medium text-[#737373]">qty</span>
                        </div>
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <div className="flex items-center gap-1 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg px-2">
                          <span className="text-xs font-bold text-[#737373]">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) => handleEditUpdateItem(index, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full py-2 bg-transparent font-bold text-xs text-[#171717] dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="col-span-3 sm:col-span-1 text-right font-bold text-xs text-[#171717] dark:text-white">
                        ₹{(item.total_price || 0).toLocaleString('en-IN')}
                      </div>

                      <div className="col-span-1 text-right">
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEditRemoveLineItem(index)}
                            className="text-[#737373] hover:text-[#DC2626] p-1.5 rounded-lg transition-colors"
                            title="Remove line item"
                            aria-label="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="p-3 bg-[#F3F4F6] dark:bg-[#262626] rounded-xl flex items-center justify-between text-xs font-bold">
                <div>
                  <span className="text-[#737373] dark:text-[#A3A3A3] block text-xs font-bold">Subtotal</span>
                  <span className="font-bold text-[#171717] dark:text-white">
                    ₹{editItems.reduce((sum, it) => sum + (it.total_price || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] dark:text-[#A3A3A3] block text-xs font-bold">Tax</span>
                  <span className="font-bold text-[#171717] dark:text-white">
                    ₹{Number(editTaxAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#737373] dark:text-[#A3A3A3] block text-xs font-bold">Updated Total</span>
                  <span className="text-sm font-black text-[#E31B23]">
                    ₹{(editItems.reduce((sum, it) => sum + (it.total_price || 0), 0) + Number(editTaxAmount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171717] dark:text-[#D4D4D4] mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Price adjustment, delivery slip reference..."
                  className="w-full p-2.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl font-medium text-xs text-[#171717] dark:text-white focus:outline-none focus:border-[#E31B23]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingPurchase(null);
                  }}
                  className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4] rounded-xl font-bold text-xs min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#E31B23] hover:bg-[#C9151C] text-white rounded-xl font-black text-xs shadow-[0_4px_14px_rgba(227,27,35,0.16)] transition-all min-h-[44px] disabled:opacity-50"
                >
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Void Supplier Purchase Modal */}
      {isDeleteModalOpen && deletingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto backdrop-enter">
          <div className="saas-card bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl modal-enter">
            <div className="flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/40 text-[#DC2626] flex items-center justify-center border border-[#FECDD3] dark:border-red-900/40">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#171717] dark:text-white">Delete Supplier Purchase?</h2>
                  <span className="font-mono text-xs font-bold text-[#E31B23]">{deletingPurchase.purchase_code}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingPurchase(null);
                }}
                className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#262626]"
                aria-label="Close Delete Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Details Summary Card */}
            <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#737373] dark:text-[#A3A3A3]">Supplier:</span>
                <span className="font-bold text-[#171717] dark:text-white">{deletingPurchase.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373] dark:text-[#A3A3A3]">Invoice Number:</span>
                <span className="font-mono font-bold text-[#171717] dark:text-white">#{deletingPurchase.invoice_number} ({deletingPurchase.invoice_date})</span>
              </div>
              <div className="flex justify-between border-t border-[#F1F1F1] dark:border-[#262626] pt-2">
                <span className="text-[#737373] dark:text-[#A3A3A3]">Total Purchase:</span>
                <span className="font-black text-[#171717] dark:text-white">₹{deletingPurchase.total_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373] dark:text-[#A3A3A3]">Amount Paid:</span>
                <span className="font-bold text-[#16A34A] dark:text-emerald-400">₹{deletingPurchase.amount_paid.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737373] dark:text-[#A3A3A3]">Outstanding:</span>
                <span className="font-bold text-[#D97706] dark:text-amber-400">₹{deletingPurchase.outstanding_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-[#F1F1F1] dark:border-[#262626] pt-2">
                <span className="text-[#737373] dark:text-[#A3A3A3] block mb-1 font-bold">Cylinder Stock Inflow to Reverse:</span>
                <div className="flex flex-wrap gap-1.5">
                  {deletingPurchase.items && deletingPurchase.items.length > 0 ? (
                    deletingPurchase.items.map((it, idx) => {
                      const ct = cylinderTypes.find((c) => c.id === it.cylinder_type_id);
                      return (
                        <span key={idx} className="px-2 py-0.5 bg-white dark:bg-[#171717] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-md font-mono font-bold text-xs text-[#171717] dark:text-white">
                          {it.quantity} × {ct?.name || 'Cylinder'}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-[#737373] dark:text-[#A3A3A3]">No line items recorded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Safety Validation Message */}
            {deletingPurchase.amount_paid > 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                    This purchase has <strong>₹{deletingPurchase.amount_paid.toLocaleString('en-IN')}</strong> in supplier payments linked to it and cannot be permanently deleted.
                  </p>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  You can <strong>Void / Cancel</strong> it instead to exclude it from stock intake while preserving the payment audit trail.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#FFF1F2] dark:bg-rose-950/30 border border-[#FECDD3] dark:border-rose-900/50 rounded-xl text-xs text-[#DC2626] dark:text-rose-400 leading-relaxed font-semibold">
                Are you sure you want to permanently delete this supplier purchase? This will atomically reverse the cylinder stock inflow and remove the record.
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingPurchase(null);
                }}
                className="px-4 py-2.5 bg-white dark:bg-[#1F1F1F] hover:bg-[#F8FAFC] dark:hover:bg-[#262626] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4] rounded-xl font-bold text-xs min-h-[44px]"
              >
                Cancel
              </button>
              {deletingPurchase.amount_paid > 0 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCancelConfirm}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
                >
                  <Ban className="w-4 h-4" />
                  <span>{submitting ? 'Cancelling...' : 'Void / Cancel Purchase'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl font-black text-xs shadow-[0_4px_14px_rgba(220,38,38,0.2)] transition-all disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{submitting ? 'Deleting...' : 'Yes, Delete Purchase'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

