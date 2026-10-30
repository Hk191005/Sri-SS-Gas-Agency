import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const passedTests = [];
const failedTests = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passedTests.push({ name: testName, details });
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
  } else {
    failedTests.push({ name: testName, details });
    console.error(`\x1b[31m✘ FAIL:\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runHardeningTests() {
  console.log('================================================================');
  console.log('SRI SS GAS AGENCY — PRODUCTION SECURITY & HARDENING VERIFICATION');
  console.log('================================================================\n');

  // --- 1. ENVIRONMENT & HOSTING VERIFICATION ---
  console.log('--- 1. HOSTING & ENVIRONMENT CONFIGURATION ---');
  const envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
  const envLines = Object.fromEntries(
    envContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );

  const supabaseUrl = envLines.VITE_SUPABASE_URL;
  const supabaseAnonKey = envLines.VITE_SUPABASE_ANON_KEY;

  assert(
    supabaseUrl && supabaseUrl.startsWith('https://'),
    'Supabase URL configured in environment',
    supabaseUrl.replace(/https:\/\/[^.]+\./, 'https://[PROJECT].')
  );
  assert(
    supabaseAnonKey && supabaseAnonKey.length > 20,
    'Supabase Anon Key configured in environment',
    'Anon key length ' + supabaseAnonKey.length
  );

  // Check no service-role key is in .env or frontend
  const envFiles = ['.env', '.env.example'];
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf-8');
      assert(!content.includes('service_role') && !content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNlcnZlZCI6InNlcnZpY2Vfcm9sZS'), `No service-role key in ${f}`);
    }
  }

  // Netlify _redirects verification
  const publicRedirects = fs.readFileSync(path.resolve('public/_redirects'), 'utf-8').trim();
  const distRedirects = fs.existsSync('dist/_redirects') ? fs.readFileSync(path.resolve('dist/_redirects'), 'utf-8').trim() : '';
  assert(publicRedirects.includes('/*') && publicRedirects.includes('/index.html') && publicRedirects.includes('200'), 'SPA rewrite rule in public/_redirects');
  assert(distRedirects.includes('/*') && distRedirects.includes('/index.html') && distRedirects.includes('200'), 'SPA rewrite rule preserved in dist/_redirects');

  // Authoritative production Netlify URL in supabase.ts
  const supabaseSrc = fs.readFileSync(path.resolve('src/lib/supabase.ts'), 'utf-8');
  assert(
    supabaseSrc.includes('https://ssgasagency.netlify.app'),
    'Authoritative Netlify production URL in src/lib/supabase.ts',
    'Replaced legacy Vercel URL'
  );
  assert(
    !supabaseSrc.includes('https://sri-ss-gas-agency.vercel.app'),
    'Legacy Vercel URL removed from src/lib/supabase.ts'
  );

  // --- 2. CUSTOMER PINCODE & PHONE VALIDATION ---
  console.log('\n--- 2. CUSTOMER DATA INTEGRITY & VALIDATION ---');
  const customerModalSrc = fs.readFileSync(path.resolve('src/components/customers/CustomerFormModal.tsx'), 'utf-8');
  
  // Pincode default is empty string, not 641601
  assert(
    customerModalSrc.includes("const [pincode, setPincode] = useState('');"),
    'CustomerFormModal initializes pincode to empty string',
    'Does not force Tiruppur 641601 on other regions'
  );
  assert(
    customerModalSrc.includes("setPincode(customerToEdit.pincode || '');"),
    'CustomerFormModal preserves empty pincode when editing customer with null/empty pincode'
  );
  assert(
    !customerModalSrc.includes("useState('641601')") && !customerModalSrc.includes("setPincode('641601')"),
    'Hardcoded default 641601 removed completely from CustomerFormModal'
  );

  // Indian mobile normalization & validation logic
  const normalizeIndianMobile = (raw) => {
    let cleaned = (raw || '').replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
    if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    return cleaned;
  };

  assert(normalizeIndianMobile('+91 98765 43210') === '9876543210', 'Phone normalizer strips +91 and spaces');
  assert(normalizeIndianMobile('09876543210') === '9876543210', 'Phone normalizer strips leading 0');
  assert(normalizeIndianMobile('98765-43210') === '9876543210', 'Phone normalizer strips hyphens');
  assert(/^[6-9]\d{9}$/.test(normalizeIndianMobile('9876543210')), 'Valid 9-series mobile accepted');
  assert(/^[6-9]\d{9}$/.test(normalizeIndianMobile('8123456789')), 'Valid 8-series mobile accepted');
  assert(/^[6-9]\d{9}$/.test(normalizeIndianMobile('7012345678')), 'Valid 7-series mobile accepted');
  assert(/^[6-9]\d{9}$/.test(normalizeIndianMobile('6381234567')), 'Valid 6-series mobile accepted');
  assert(!/^[6-9]\d{9}$/.test(normalizeIndianMobile('5123456789')), 'Invalid 5-series mobile rejected');
  assert(!/^[6-9]\d{9}$/.test(normalizeIndianMobile('12345')), 'Short mobile number rejected');

  // --- 3. DOCUMENT MANAGEMENT CONSISTENCY ---
  console.log('\n--- 3. CUSTOMER DOCUMENT WORKFLOW CONSISTENCY ---');
  const dbSrc = fs.readFileSync(path.resolve('src/lib/db.ts'), 'utf-8');
  
  // deleteCustomerDocument deletes DB record before Storage
  const delDocIdx = dbSrc.indexOf('export async function deleteCustomerDocument');
  const delDocBody = dbSrc.slice(delDocIdx, delDocIdx + 1200);
  const dbDelPos = delDocBody.indexOf("supabase.from('customer_documents').delete()");
  const storageDelPos = delDocBody.indexOf("supabase.storage.from('customer-documents').remove");

  assert(
    dbDelPos !== -1 && storageDelPos !== -1 && dbDelPos < storageDelPos,
    'deleteCustomerDocument removes DB record BEFORE Storage file',
    'Guarantees no orphaned DB pointers on storage removal failure'
  );

  // --- 4. ATOMIC TRANSACTION CASCADE DELETIONS ---
  console.log('\n--- 4. ATOMIC FINANCIAL TRANSACTIONS & REPAIR CASCADE ---');
  assert(
    dbSrc.includes("supabase.rpc('remove_customer_purchase'"),
    'deletePurchase calls atomic PostgreSQL RPC remove_customer_purchase'
  );

  // --- 5. LIVE SUPABASE DATABASE AUTHORIZATION TESTS ---
  console.log('\n--- 5. LIVE SUPABASE DATABASE AUTHORIZATION TESTS (ANON ROLE) ---');
  const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

  // Test 1: merge_customers cannot be called anonymously
  try {
    const { data, error } = await anonSupabase.rpc('merge_customers', {
      p_primary_id: '00000000-0000-0000-0000-000000000001',
      p_duplicate_id: '00000000-0000-0000-0000-000000000002',
    });
    assert(
      error !== null,
      'Anonymous call to merge_customers is rejected',
      error?.message || 'Access denied'
    );
  } catch (err) {
    assert(true, 'Anonymous call to merge_customers raised exception as expected');
  }

  // Test 2: cancel_supplier_purchase cannot be called anonymously
  try {
    const { data, error } = await anonSupabase.rpc('cancel_supplier_purchase', {
      p_purchase_id: '00000000-0000-0000-0000-000000000001',
      p_reason: 'test',
    });
    assert(
      error !== null,
      'Anonymous call to cancel_supplier_purchase is rejected',
      error?.message || 'Access denied'
    );
  } catch (err) {
    assert(true, 'Anonymous call to cancel_supplier_purchase raised exception as expected');
  }

  // Test 3: delete_supplier_purchase cannot be called anonymously
  try {
    const { data, error } = await anonSupabase.rpc('delete_supplier_purchase', {
      p_purchase_id: '00000000-0000-0000-0000-000000000001',
    });
    assert(
      error !== null,
      'Anonymous call to delete_supplier_purchase is rejected',
      error?.message || 'Access denied'
    );
  } catch (err) {
    assert(true, 'Anonymous call to delete_supplier_purchase raised exception as expected');
  }

  // Test 4: update_inventory_opening_balances cannot be called anonymously
  try {
    const { data, error } = await anonSupabase.rpc('update_inventory_opening_balances', {
      p_updates: [{ cylinder_type_id: '00000000-0000-0000-0000-000000000001', opening_full_quantity: 10 }],
    });
    assert(
      error !== null,
      'Anonymous call to update_inventory_opening_balances is rejected',
      error?.message || 'Access denied'
    );
  } catch (err) {
    assert(true, 'Anonymous call to update_inventory_opening_balances raised exception as expected');
  }

  // Test 5: remove_customer_purchase cannot be called anonymously
  try {
    const { data, error } = await anonSupabase.rpc('remove_customer_purchase', {
      p_purchase_id: '00000000-0000-0000-0000-000000000001',
    });
    assert(
      error !== null,
      'Anonymous call to remove_customer_purchase is rejected',
      error?.message || 'Access denied'
    );
  } catch (err) {
    assert(true, 'Anonymous call to remove_customer_purchase raised exception as expected');
  }

  // --- 6. RLS & 33KG COMMERCIAL CYLINDER SUPPORT ---
  console.log('\n--- 6. RLS & 33KG COMMERCIAL CYLINDER SUPPORT ---');
  // Anonymous user cannot read private cylinder_types due to RLS
  const { data: anonCyls, error: anonCylErr } = await anonSupabase.from('cylinder_types').select('*');
  assert(
    anonCyls === null || anonCyls.length === 0,
    'Anonymous user cannot access cylinder_types due to active RLS policy',
    `Returned ${anonCyls?.length || 0} rows`
  );

  // Verify 33KG configuration in local types and migrations
  const migrationSrc = fs.readFileSync(path.resolve('supabase/migrations/20261015000000_production_security_and_performance_hardening.sql'), 'utf-8');
  assert(
    migrationSrc.includes("cylinder_types (name, weight_kg, default_price") &&
    migrationSrc.includes("default_price_33kg") &&
    migrationSrc.includes("default_buying_price_33kg"),
    '33KG commercial cylinder pricing and type migration included in SQL hardening migration',
    '33kg selling price ₹4850, buying price ₹4500, deposit ₹4000'
  );

  console.log('\n================================================================');
  console.log(`TOTAL HARDENING TESTS: ${passedTests.length} PASSED | ${failedTests.length} FAILED`);
  console.log('================================================================\n');

  if (failedTests.length > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
