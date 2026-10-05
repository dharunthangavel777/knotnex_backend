import axios from 'axios';
import { query } from '../src/config/database';

async function main() {
  const ts = Date.now();
  const testEmail = `test_sanjay_${ts}@knotnex.test`;
  const testName = 'Sanjay Kumar';
  const testPass = 'Password123!';

  console.log('📌 1. Initiate Signup');
  const initRes = await axios.post('http://localhost:8080/api/v1/auth/initiate-signup', {
    email: testEmail,
    fullName: testName,
  });
  const otp = initRes.data.data?.debugOtp || '1234';
  console.log('  ✅ Signup initiated, debug OTP:', otp);

  console.log('📌 2. Verify Signup OTP');
  const otpRes = await axios.post('http://localhost:8080/api/v1/auth/verify-signup-otp', {
    email: testEmail,
    otp,
  });
  const regToken = otpRes.data.data.registrationToken;
  console.log('  ✅ OTP verified, registration token received');

  console.log('📌 3. Complete Signup with fullName');
  const compRes = await axios.post('http://localhost:8080/api/v1/auth/complete-signup', {
    registrationToken: regToken,
    password: testPass,
    fullName: testName,
  });
  const createdUser = compRes.data.data.user;
  console.log('  ✅ User registered. Name returned:', createdUser.fullName);

  if (createdUser.fullName !== testName) {
    throw new Error(`FAILED: Expected fullName "${testName}" but got "${createdUser.fullName}"`);
  }

  console.log('📌 4. Sign in with Email & Password');
  const signinRes = await axios.post('http://localhost:8080/api/v1/auth/signin', {
    email: testEmail,
    password: testPass,
  });
  const token = signinRes.data.data.tokens.accessToken;
  console.log('  ✅ Signin success, JWT access token acquired');

  console.log('📌 5. Fetch Profile (GET /users/profile)');
  const profRes = await axios.get('http://localhost:8080/api/v1/users/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const profile = profRes.data.data;
  console.log('  ✅ Profile fetched:');
  console.log('     Name in DB:', profile.full_name);
  console.log('     Email in DB:', profile.email);
  console.log('     Verified:', profile.is_verified);

  if (profile.full_name !== testName) {
    throw new Error(`FAILED: Profile full_name is "${profile.full_name}" instead of "${testName}"`);
  }

  console.log('📌 6. Clean up test user');
  await query('DELETE FROM users WHERE email = $1', [testEmail]);
  console.log('  ✅ Test user cleaned up');

  console.log('\n======================================================');
  console.log('🎉 ALL SIGNUP NAME AND PROFILE VERIFICATION TESTS PASSED!');
  console.log('======================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
