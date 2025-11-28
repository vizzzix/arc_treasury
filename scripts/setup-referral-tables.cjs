/**
 * Script to setup referral tables in Supabase
 * Run this with: node scripts/setup-referral-tables.js
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        return { exists: false, error: 'Table does not exist' };
      }
      return { exists: false, error: error.message };
    }

    return { exists: true };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function testReferralCodeGeneration() {
  console.log('\n🧪 Testing referral code generation...');

  const testAddress = '0x1234567890123456789012345678901234567890';

  try {
    // Test generate-code endpoint
    const response = await fetch(`${SUPABASE_URL.replace('.supabase.co', '')}/api/referral/generate-code?address=${testAddress}`);

    if (!response.ok) {
      console.log('❌ Cannot test generate-code endpoint (this is expected if API routes are not deployed)');
      return;
    }

    const data = await response.json();
    console.log('✅ Generate code works:', data);

    // Test resolve-code endpoint
    if (data.code) {
      const resolveResponse = await fetch(`${SUPABASE_URL.replace('.supabase.co', '')}/api/referral/resolve-code?code=${data.code}`);
      const resolveData = await resolveResponse.json();
      console.log('✅ Resolve code works:', resolveData);
    }
  } catch (err) {
    console.log('⚠️  Cannot test API endpoints:', err.message);
  }
}

async function main() {
  console.log('🚀 Arc Treasury - Referral System Setup\n');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Using API Key:', SUPABASE_KEY.substring(0, 20) + '...\n');

  // Check referral_codes table
  console.log('📋 Checking referral_codes table...');
  const referralCodesCheck = await checkTable('referral_codes');
  if (referralCodesCheck.exists) {
    console.log('✅ referral_codes table exists');
  } else {
    console.log('❌ referral_codes table does not exist');
    console.log('   Error:', referralCodesCheck.error);
  }

  // Check referrals table
  console.log('\n📋 Checking referrals table...');
  const referralsCheck = await checkTable('referrals');
  if (referralsCheck.exists) {
    console.log('✅ referrals table exists');
  } else {
    console.log('❌ referrals table does not exist');
    console.log('   Error:', referralsCheck.error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SETUP STATUS');
  console.log('='.repeat(60));

  if (referralCodesCheck.exists && referralsCheck.exists) {
    console.log('✅ All tables are set up correctly!');
    await testReferralCodeGeneration();
  } else {
    console.log('⚠️  Some tables are missing. Please follow these steps:\n');
    console.log('1. Go to your Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/' + SUPABASE_URL.split('//')[1].split('.')[0]);
    console.log('\n2. Open SQL Editor\n');
    console.log('3. Copy and run the SQL from: supabase-schema.sql\n');
    console.log('4. Run this script again to verify\n');
  }

  console.log('\n📚 For detailed instructions, see: REFERRAL_SETUP.md');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
