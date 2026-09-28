# Sri SS Gas Agency — Management System

A high-performance enterprise web application designed for **Sri SS Gas Agency** (Tiruppur District, Tamil Nadu, India) to manage customer lifecycles, cylinder refills, inventory baselines, commercial supplier purchases, multi-tier pricing, GST tax invoicing, and account security.

---

## 🚀 Tech Stack

- **Frontend Core**: React 19, TypeScript 5.8, Vite 8.2
- **Styling**: TailwindCSS with CSS custom tokens, dark mode support, and reduced-motion compliance
- **Backend & Database**: Supabase (PostgreSQL 15+, Row Level Security, RPC stored procedures, Triggers, Sequences)
- **Authentication**: Supabase Auth with admin role mapping, multi-device session sync, and 30-minute inactivity auto-logout
- **Storage**: Supabase Private Storage (`customer-documents` bucket) with time-limited signed URLs
- **Reporting & Invoicing**: jsPDF & jsPDF-AutoTable for automated A4 GST Tax Invoices and regular retail bills
- **Icons**: Lucide React

---

## 📦 Cylinder Specifications Supported

The agency authoritatively supports 5 commercial and domestic cylinder sizes:
- **4 KG** (Domestic Mini Refill)
- **12 KG** (Commercial Refill)
- **17 KG** (Commercial Heavy Refill)
- **21 KG** (Industrial Refill)
- **33 KG** (Heavy Industrial / Commercial Refill)

Each cylinder size supports configurable:
- Customer Selling (Refill) Price
- Supplier Acquisition (Buying) Price
- Held Security Deposit (Liability, non-revenue)
- Opening Warehouse Stock Baseline
- Automated Customer Refill Reminders (interval & lead days)

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Hk191005/Sri-SS-Gas-Agency.git
   cd "Sri-SS-Gas-Agency"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   > ⚠️ **SECURITY WARNING**: Never commit real Supabase service-role keys or production secrets to Git.

4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🗄️ Database & Supabase Setup

### Migration Structure
All database schema, functions, RLS policies, and data migrations are version-controlled under `supabase/migrations/`:

| Migration File | Description |
|---|---|
| `20260828000000_initial_schema.sql` | Core schema (customers, purchases, payments, deposits, deliveries, cylinders, audit logs) |
| `20260828000001_single_admin_security_and_storage.sql` | Storage bucket configuration & admin policies |
| `20260828000005_production_upgrade.sql` | Production schema improvements & sequences |
| `20260828000007_four_kg_and_supplier_manual_entry.sql` | 4KG cylinder sizing and manual supplier entry |
| `20260828000010_inventory_opening_balances.sql` | Authoritative opening stock balance tables |
| `20260907000000_customer_renumber_merge_and_docs.sql` | Customer code renumbering, document types, customer merge RPC |
| `20260927000000_sale_transaction_and_thirty_three_kg_support.sql` | 33KG settings columns and atomic `create_sale_transaction()` RPC |

### Storage Bucket Setup
1. Create a private storage bucket named `customer-documents`.
2. Apply the RLS policies in `supabase/migrations/20260828000001_single_admin_security_and_storage.sql` to restrict access to authenticated administrator sessions.
3. All document previews and downloads utilize signed URLs generated server-side via `supabase.storage.from('customer-documents').createSignedUrl(...)`.

---

## 🔐 Authentication & Session Security

- **Multi-device Protection**: Real-time broadcast channel tracks cross-tab logout events.
- **Inactivity Timeout**: 30 minutes of inactivity prompts a 2-minute countdown warning modal before automatically clearing session state.
- **Password Recovery**: Secure password reset flow triggered through Supabase Auth email tokens redirecting to `/reset-password`.
- **Backend Customer Validation**: Sales and refill transactions strictly enforce that the recipient customer is active (`is_active = true AND deleted_at IS NULL`) before committing records.

---

## 💰 Billing & GST Financial Integrity

- **Intra-State Invoices (Tamil Nadu - State Code 33)**: 18% Total GST split equally into 9% CGST and 9% SGST.
- **Inter-State Invoices**: 18% IGST applied to taxable gas value.
- **Security Deposit**: Classified as a refundable customer liability; strictly excluded from gas sales revenue and GST taxable value.
- **Empty Cylinder Return**: Recorded as operational tracking at ₹0 value; never inflates sale amounts.

---

## 🧪 Testing & Verification

### Type Checking
```bash
npx tsc --noEmit
```

### Code Linting
```bash
npm run lint
```

### Production Build
```bash
npm run build
```

### Automated Playwright Regression Tests
```bash
npx playwright test
```

---

## 🌐 Deployment (Netlify / Vercel)

### Netlify Deployment
1. Connect repository in Netlify dashboard.
2. Build Command: `npm run build`
3. Publish Directory: `dist`
4. Set Environment Variables in Site Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. The repository includes single-page app redirection rules (`/* /index.html 200`).

---

## 📄 License & Ownership

Proprietary software developed exclusively for **Sri SS Gas Agency**. All rights reserved.
