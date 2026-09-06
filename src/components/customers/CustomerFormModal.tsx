import React, { useState, useEffect } from 'react';
import type { Customer, CylinderType, CustomerDocument, DocumentType } from '../../types/database.types';
import {
  createCustomerWithInitialGas,
  updateCustomer,
  getCylinderTypes,
  uploadCustomerDocument,
  getCustomerDocuments,
  deleteCustomerDocument,
} from '../../lib/db';
import { useToast } from '../../context/ToastContext';
import { GPSLocationPicker } from './GPSLocationPicker';
import {
  X,
  User,
  Building2,
  Phone,
  MapPin,
  FileText,
  Save,
  AlertCircle,
  ShoppingBag,
  Lock,
  ExternalLink,
  Trash2,
  Upload,
  Loader2,
} from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: Customer | null;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit,
}) => {
  const isEditing = !!customerToEdit;
  const { showSuccess, showError } = useToast();

  // Form State
  const [customerType, setCustomerType] = useState<'individual' | 'company'>('individual');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [area1, setArea1] = useState('');
  const [area2, setArea2] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Tiruppur');
  const [district] = useState('Tiruppur');
  const [pincode, setPincode] = useState('641601');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(true);

  // Initial Gas Purchase (Creation only)
  const [includeInitialGas, setIncludeInitialGas] = useState(true);
  const [selectedCylinderTypeId, setSelectedCylinderTypeId] = useState('');
  const [gasQuantity, setGasQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('cash');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // Document Upload & Existing Documents State
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('aadhaar');
  const [existingDocuments, setExistingDocuments] = useState<CustomerDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Operational State
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [altPhoneError, setAltPhoneError] = useState('');
  const [pincodeError, setPincodeError] = useState('');

  const loadExistingDocuments = async (customerId: string) => {
    setLoadingDocs(true);
    try {
      const docs = await getCustomerDocuments(customerId);
      setExistingDocuments(docs);
    } catch (err: any) {
      console.error('Failed to load existing customer documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDeleteExistingDoc = async (doc: CustomerDocument) => {
    const confirmed = window.confirm(`Delete document "${doc.original_filename}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingDocId(doc.id);
    try {
      await deleteCustomerDocument(doc.id, doc.storage_path);
      showSuccess(`Document "${doc.original_filename}" removed successfully.`);
      if (customerToEdit) {
        await loadExistingDocuments(customerToEdit.id);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  };

  const loadInitialData = async () => {
    setErrorMsg('');
    setPhoneError('');
    setAltPhoneError('');
    setPincodeError('');
    setDocFile(null);

    try {
      const types = await getCylinderTypes();
      setCylinderTypes(types);

      if (customerToEdit) {
        setCustomerType(customerToEdit.customer_type);
        setName(customerToEdit.name);
        setCompanyName(customerToEdit.company_name || '');
        setContactPersonName(customerToEdit.contact_person_name || '');
        setPhone(customerToEdit.phone);
        setAlternatePhone(customerToEdit.alternate_phone || '');
        setArea1(customerToEdit.area1 || '');
        setArea2(customerToEdit.area2 || '');
        setStreet(customerToEdit.street || '');
        setLandmark(customerToEdit.landmark || '');
        setCity(customerToEdit.city || 'Tiruppur');
        setPincode(customerToEdit.pincode || '641601');
        setLatitude(customerToEdit.latitude || undefined);
        setLongitude(customerToEdit.longitude || undefined);
        setNotes(customerToEdit.notes || '');
        setSmsEnabled(customerToEdit.sms_enabled !== false);
        setWhatsappEnabled(customerToEdit.whatsapp_enabled !== false);
        setEmailEnabled(customerToEdit.email_enabled !== false);
        setMarketingEnabled(customerToEdit.marketing_enabled !== false);
        setIncludeInitialGas(false);

        // Fetch existing documents from Supabase private storage
        loadExistingDocuments(customerToEdit.id);
      } else {
        setExistingDocuments([]);
        // Reset defaults
        setCustomerType('individual');
        setName('');
        setCompanyName('');
        setContactPersonName('');
        setPhone('');
        setAlternatePhone('');
        setArea1('');
        setArea2('');
        setStreet('');
        setLandmark('');
        setCity('Tiruppur');
        setPincode('641601');
        setLatitude(undefined);
        setLongitude(undefined);
        setNotes('');
        setSmsEnabled(true);
        setWhatsappEnabled(true);
        setEmailEnabled(true);
        setMarketingEnabled(true);
        setIncludeInitialGas(true);
        setGasQuantity(1);

        if (types.length > 0) {
          const defaultType = types[0];
          setSelectedCylinderTypeId(defaultType.id);
          const currentPrice = defaultType.default_price;
          const currentDeposit = defaultType.default_deposit !== undefined ? defaultType.default_deposit : 1000;
          setUnitPrice(currentPrice);
          setDepositAmount(currentDeposit);
          setPaymentAmount(currentPrice * 1 + currentDeposit);
        } else {
          setUnitPrice(650);
          setDepositAmount(1000);
          setPaymentAmount(1650);
        }
      }
    } catch (e) {
      console.error('Failed to initialize customer form modal', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    let valid = true;
    setPhoneError('');
    setAltPhoneError('');
    setPincodeError('');

    // Phone: Must be 10 digits
    if (!/^\d{10}$/.test(phone.trim())) {
      setPhoneError('Primary phone number must be exactly 10 digits.');
      valid = false;
    }

    // Alt Phone: optional, but if provided must be 10 digits
    if (alternatePhone.trim() && !/^\d{10}$/.test(alternatePhone.trim())) {
      setAltPhoneError('Alternate phone must be exactly 10 digits.');
      valid = false;
    }

    // Pincode: 6 digits
    if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      setPincodeError('Pincode must be exactly 6 digits.');
      valid = false;
    }

    return valid;
  };

  const handleCylinderTypeChange = (typeId: string) => {
    setSelectedCylinderTypeId(typeId);
    const selected = cylinderTypes.find((t) => t.id === typeId);
    if (selected) {
      setUnitPrice(selected.default_price);
      const dep = selected.default_deposit !== undefined ? selected.default_deposit : 2000;
      setDepositAmount(dep);
      setPaymentAmount(selected.default_price * gasQuantity + dep);
    }
  };

  const handleQuantityChange = (qty: number) => {
    const validQty = Math.max(1, qty);
    setGasQuantity(validQty);
    setPaymentAmount(validQty * unitPrice + depositAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const finalName = customerType === 'company' ? companyName.trim() : name.trim();

      if (!finalName) {
        throw new Error(customerType === 'company' ? 'Company Name is required' : 'Customer Name is required');
      }

      if (isEditing && customerToEdit) {
        await updateCustomer(customerToEdit.id, {
          name: finalName,
          customer_type: customerType,
          company_name: customerType === 'company' ? companyName.trim() : undefined,
          contact_person_name: customerType === 'company' ? contactPersonName.trim() : undefined,
          phone: phone.trim(),
          alternate_phone: alternatePhone.trim() || undefined,
          street: street.trim() || undefined,
          landmark: landmark.trim() || undefined,
          area1: area1.trim() || undefined,
          area2: area2.trim() || undefined,
          city: city.trim() || 'Tiruppur',
          district: 'Tiruppur',
          pincode: pincode.trim() || undefined,
          latitude,
          longitude,
          notes: notes.trim() || undefined,
          sms_enabled: smsEnabled,
          whatsapp_enabled: whatsappEnabled,
          email_enabled: emailEnabled,
          marketing_enabled: marketingEnabled,
        });

        if (docFile) {
          await uploadCustomerDocument(customerToEdit.id, docFile, docType);
        }
      } else {
        // Register new customer
        const newCustomer = await createCustomerWithInitialGas({
          name: finalName,
          customer_type: customerType,
          company_name: customerType === 'company' ? companyName.trim() : undefined,
          contact_person_name: customerType === 'company' ? contactPersonName.trim() : undefined,
          phone: phone.trim(),
          alternate_phone: alternatePhone.trim() || undefined,
          street: street.trim() || undefined,
          landmark: landmark.trim() || undefined,
          area1: area1.trim() || undefined,
          area2: area2.trim() || undefined,
          city: city.trim() || 'Tiruppur',
          district: 'Tiruppur',
          pincode: pincode.trim() || undefined,
          latitude,
          longitude,
          notes: notes.trim() || undefined,
          sms_enabled: smsEnabled,
          whatsapp_enabled: whatsappEnabled,
          email_enabled: emailEnabled,
          marketing_enabled: marketingEnabled,
          cylinder_type_id: includeInitialGas ? selectedCylinderTypeId : undefined,
          quantity: includeInitialGas ? gasQuantity : undefined,
          unit_price: includeInitialGas ? unitPrice : undefined,
          deposit_amount: includeInitialGas && depositAmount > 0 ? depositAmount : undefined,
          payment_amount: includeInitialGas && paymentAmount > 0 ? paymentAmount : undefined,
          payment_method: includeInitialGas ? paymentMethod : undefined,
          purchase_date: includeInitialGas ? purchaseDate : undefined,
        });

        if (docFile && newCustomer.id) {
          await uploadCustomerDocument(newCustomer.id, docFile, docType);
        }
      }

      onSuccess();
      onClose();
      showSuccess(isEditing ? 'Customer details updated successfully!' : 'Customer registered successfully in database!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to save customer details. Please try again.');
      showError(err.message || 'Failed to save customer details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-white dark:bg-[#171717] text-[#171717] dark:text-white px-6 py-4 flex items-center justify-between border-b border-[#F1F1F1] dark:border-[#262626]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#171717] dark:text-white flex items-center gap-2">
              {isEditing ? <User className="w-5 h-5 text-[#E31B23]" /> : <User className="w-5 h-5 text-[#E31B23]" />}
              {isEditing ? `Edit Customer — ${customerToEdit.customer_code}` : 'New Customer Registration'}
            </h2>
            <p className="text-xs font-semibold text-[#525252] dark:text-[#D4D4D4] mt-0.5">SRI SS GAS AGENCY — Tiruppur District Directory</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#171717] dark:hover:text-white p-1.5 rounded-lg hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-[#171717] dark:text-[#F5F5F5]">
          {errorMsg && (
            <div className="p-3 bg-[#FFF1F2] border border-[#FFD6D8] text-[#DC2626] text-xs rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Customer Type Selector */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-black text-[#525252] uppercase tracking-wider mb-2">
                Customer Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCustomerType('individual')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-xs font-black transition-all ${
                    customerType === 'individual'
                      ? 'bg-[#FFF1F2] border-[#FFD6D8] text-[#C9151C]'
                      : 'bg-[#FAFAFA] dark:bg-[#1F1F1F] border-[#E5E5E5] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4]'
                  }`}
                >
                  <User className="w-4 h-4" /> Individual Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerType('company')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-xs font-black transition-all ${
                    customerType === 'company'
                      ? 'bg-[#FFF1F2] border-[#FFD6D8] text-[#C9151C]'
                      : 'bg-[#FAFAFA] dark:bg-[#1F1F1F] border-[#E5E5E5] dark:border-[#2A2A2A] text-[#525252] dark:text-[#D4D4D4]'
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Company / Commercial
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Basic & Contact Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-[#525252] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#F1F1F1] dark:border-[#262626] pb-1">
              <Phone className="w-3.5 h-3.5 text-[#E31B23]" /> Basic & Contact Details
            </h3>

            {customerType === 'individual' ? (
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Customer Full Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                    Company Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Tiruppur Garments Ltd"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                    Contact Person Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    placeholder="e.g. Senthil Nathan"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Primary Mobile Number (10 Digits) <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border rounded-xl text-xs text-[#171717] dark:text-white font-bold focus:outline-none ${
                    phoneError ? 'border-[#DC2626]' : 'border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#E31B23]'
                  }`}
                />
                {phoneError && <p className="text-[11px] text-[#DC2626] mt-1 font-bold">{phoneError}</p>}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">
                  Alternate Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="8765432109"
                  className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border rounded-xl text-xs text-[#171717] dark:text-white font-bold focus:outline-none ${
                    altPhoneError ? 'border-[#DC2626]' : 'border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#E31B23]'
                  }`}
                />
                {altPhoneError && <p className="text-[11px] text-[#DC2626] mt-1 font-bold">{altPhoneError}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Address & Location (Tiruppur Restricted) */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-[#525252] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#F1F1F1] dark:border-[#262626] pb-1">
              <MapPin className="w-3.5 h-3.5 text-[#E31B23]" /> Address & Geolocation (Tiruppur District)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Area 1 (Locality)</label>
                <input
                  type="text"
                  value={area1}
                  onChange={(e) => setArea1(e.target.value)}
                  placeholder="e.g. Palladam Road"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Area 2 (Sub-locality)</label>
                <input
                  type="text"
                  value={area2}
                  onChange={(e) => setArea2(e.target.value)}
                  placeholder="e.g. Nallur"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Street / Door No.</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. 14/B, Gandhi Nagar"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Near Water Tank"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">City / Town</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Tiruppur"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white font-semibold focus:border-[#E31B23] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">District</label>
                <input
                  type="text"
                  readOnly
                  value={district}
                  className="w-full px-3.5 py-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#737373] font-bold cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Pincode (6 Digits)</label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="641601"
                className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#1F1F1F] border rounded-xl text-xs text-[#171717] dark:text-white font-bold focus:outline-none ${
                  pincodeError ? 'border-[#DC2626]' : 'border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#E31B23]'
                }`}
              />
              {pincodeError && <p className="text-[11px] text-[#DC2626] mt-1 font-bold">{pincodeError}</p>}
            </div>

            {/* GPS Geolocation Component */}
            <GPSLocationPicker
              latitude={latitude}
              longitude={longitude}
              onLocationCaptured={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
          </div>

          {/* Section 4: Communication & Notification Preferences */}
          <div className="space-y-3 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
            <h3 className="text-xs font-black text-[#525252] dark:text-[#A3A3A3] uppercase tracking-wider">
              Communication & Notification Preferences
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] cursor-pointer text-xs font-bold text-[#171717] dark:text-white">
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={(e) => setWhatsappEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                />
                <span>WhatsApp</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] cursor-pointer text-xs font-bold text-[#171717] dark:text-white">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                />
                <span>SMS Alerts</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] cursor-pointer text-xs font-bold text-[#171717] dark:text-white">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                />
                <span>Email Notice</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] cursor-pointer text-xs font-bold text-[#171717] dark:text-white">
                <input
                  type="checkbox"
                  checked={marketingEnabled}
                  onChange={(e) => setMarketingEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#E31B23] focus:ring-[#E31B23]"
                />
                <span>Festival Wishes</span>
              </label>
            </div>
          </div>

          {/* Section 5: Initial Gas Details */}
          {!isEditing && (
            <div className="space-y-4 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-[#525252] uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#16A34A]" /> Initial Gas Details & Deposit
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-[#E31B23]">
                  <input
                    type="checkbox"
                    checked={includeInitialGas}
                    onChange={(e) => setIncludeInitialGas(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#E31B23]"
                  />
                  <span>Add Initial Gas Sale Now</span>
                </label>
              </div>

              {includeInitialGas && (
                <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Cylinder Type</label>
                      <select
                        value={selectedCylinderTypeId}
                        onChange={(e) => handleCylinderTypeChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      >
                        {cylinderTypes.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.name} (₹{ct.default_price})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={gasQuantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Refill Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={unitPrice}
                        onChange={(e) => {
                          const p = parseFloat(e.target.value) || 0;
                          setUnitPrice(p);
                          setPaymentAmount(gasQuantity * p + depositAmount);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Security Deposit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={depositAmount}
                        onChange={(e) => {
                          const dep = parseFloat(e.target.value) || 0;
                          setDepositAmount(dep);
                          setPaymentAmount(gasQuantity * unitPrice + dep);
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Initial Payment Received (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Financial Breakdown Preview */}
                  <div className="p-3 bg-white dark:bg-[#171717] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#737373] font-bold block text-[10px] uppercase">Gas Refill Amount:</span>
                      <span className="font-extrabold text-[#111111] dark:text-white">₹{(gasQuantity * unitPrice).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[#737373] font-bold block text-[10px] uppercase">Security Deposit Held:</span>
                      <span className="font-extrabold text-[#D97706]">₹{depositAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#737373] font-bold block text-[10px] uppercase">Total Customer Initial Due:</span>
                      <span className="font-black text-sm text-[#E31B23]">₹{(gasQuantity * unitPrice + depositAmount).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full sm:w-1/3 px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 5: Documents & Notes */}
          <div className="space-y-4 pt-2 border-t border-[#F1F1F1] dark:border-[#262626]">
            <h3 className="text-xs font-black text-[#525252] dark:text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#E31B23]" /> Documents & Notes
            </h3>

            <div>
              <label className="block text-xs font-extrabold text-[#525252] dark:text-[#D4D4D4] mb-1">Customer Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special delivery instructions or customer notes..."
                className="w-full px-3.5 py-2 bg-white dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs text-[#171717] dark:text-white focus:border-[#E31B23] focus:outline-none font-semibold"
              />
            </div>

            {/* Existing Documents Section (Shown when editing customer) */}
            {isEditing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#171717] dark:text-white flex items-center gap-1.5">
                    <span>Existing Documents</span>
                    <span className="text-[10px] bg-[#FFF1F2] dark:bg-red-950/40 text-[#E31B23] px-2 py-0.5 rounded-full font-extrabold border border-[#FFD6D8] dark:border-red-900/40">
                      {existingDocuments.length}
                    </span>
                  </h4>
                  <span className="text-[10px] font-bold text-[#16A34A] flex items-center gap-1 bg-[#F0FDF4] dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    <Lock className="w-3 h-3" /> Private Storage Vault
                  </span>
                </div>

                {loadingDocs ? (
                  <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-center text-xs text-[#737373] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#E31B23]" />
                    <span>Loading customer documents...</span>
                  </div>
                ) : existingDocuments.length === 0 ? (
                  <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-center text-xs text-[#737373]">
                    <p className="font-bold text-[#525252] dark:text-[#D4D4D4]">No documents uploaded yet.</p>
                    <p className="text-[11px] text-[#737373] mt-0.5">Attach Aadhaar or verification files below.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {existingDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-between gap-3 hover:border-[#D4D4D4] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                              doc.document_type === 'aadhaar'
                                ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                                : 'bg-white dark:bg-[#262626] text-[#E31B23] border-[#E5E5E5] dark:border-[#333]'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#171717] dark:text-white truncate">
                                {doc.original_filename}
                              </span>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border shrink-0 ${
                                  doc.document_type === 'aadhaar'
                                    ? 'bg-[#F0FDF4] text-[#16A34A] border-emerald-200/60'
                                    : 'bg-[#FAFAFA] text-[#737373] border-[#E5E5E5]'
                                }`}
                              >
                                {doc.document_type === 'aadhaar' ? 'Aadhaar Card' : doc.document_type}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#737373] mt-0.5">
                              Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {doc.signed_url ? (
                            <a
                              href={doc.signed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#262626] border border-[#E5E5E5] dark:border-[#333] hover:border-[#E31B23] text-[#171717] dark:text-white hover:text-[#E31B23] text-[11px] font-bold rounded-lg transition-colors shadow-2xs"
                              title="View document in new tab"
                            >
                              <ExternalLink className="w-3 h-3 text-[#E31B23]" />
                              <span>View</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-[#737373] font-bold">Encrypted</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteExistingDoc(doc)}
                            disabled={deletingDocId === doc.id}
                            className="p-1.5 text-[#DC2626] hover:bg-[#FFF1F2] dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete this document"
                          >
                            {deletingDocId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upload New Document Box */}
            <div className="p-4 bg-[#FAFAFA] dark:bg-[#1F1F1F] rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3">
              <label className="block text-xs font-black text-[#171717] dark:text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#E31B23]" />
                  {isEditing ? 'Upload New Document' : 'Upload Document'}
                </span>
                <span className="text-[10px] font-semibold text-[#737373]">Private Storage (JPG, PNG, PDF)</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <select
                  value={docType}
                  onChange={(e: any) => setDocType(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-[#171717] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-xs font-bold text-[#171717] dark:text-white"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="other">Other Document / License</option>
                </select>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-xs text-[#525252] dark:text-[#D4D4D4] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FFF1F2] file:text-[#C9151C] hover:file:bg-[#FFD6D8]"
                />
              </div>
              {isEditing && (
                <p className="text-[11px] text-[#737373]">
                  Attach an additional document. Existing documents will remain intact.
                </p>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F1F1] dark:border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#525252] dark:text-[#D4D4D4] hover:bg-[#FAFAFA] dark:hover:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-[#E31B23] hover:bg-[#C9151C] shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Saving Customer...' : isEditing ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
