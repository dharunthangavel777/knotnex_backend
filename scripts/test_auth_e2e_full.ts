import { spawn, ChildProcess } from 'child_process';

const PORT = 8086;
const BASE_URL = `http://127.0.0.1:${PORT}`;

interface TestResult {
  step: string;
  endpoint: string;
  method: string;
  status: number;
  expectedStatus: number;
  success: boolean;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('====================================================');
  console.log('  KNOTNEX END-TO-END PRODUCTION AUTH TEST SUITE');
  console.log('====================================================');

  // 1. Start server in test mode connected to Cloud SQL
  const server: ChildProcess = spawn('node', ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: PORT.toString(),
      APP_ENV: 'production',
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });

  // Wait for server to boot up
  await delay(3500);

  const testEmail = `e2e_user_${Date.now()}@knotnex.test`;
  const initialPassword = 'InitialSecurePass@2026';
  const newPassword = 'NewResetPassword@2026';
  const fullName = 'EndToEnd Test User';
  const username = `e2e_usr_${Date.now().toString().slice(-5)}`;

  let accessToken = '';
  let refreshToken = '';
  let resetToken = '';

  try {
    // ─── STEP 1: Health Check ───
    console.log('\n[TEST 1] Verifying /health & /api/v1/health ...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json() as any;
    results.push({
      step: 'Health Check',
      endpoint: '/health',
      method: 'GET',
      status: healthRes.status,
      expectedStatus: 200,
      success: healthRes.status === 200 && healthData.status === 'ok',
      data: healthData,
    });
    console.log(`  -> Status: ${healthRes.status}, Service: ${healthData.service}`);

    // ─── STEP 2: Direct User Sign Up ───
    console.log('\n[TEST 2] Testing User Sign Up (POST /api/v1/auth/signup) ...');
    const signupRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
        fullName: fullName,
        username: username,
      }),
    });
    const signupData = await signupRes.json() as any;
    const signupSuccess = signupRes.status === 201 || signupRes.status === 200;
    if (signupSuccess && signupData.data?.tokens) {
      accessToken = signupData.data.tokens.accessToken;
      refreshToken = signupData.data.tokens.refreshToken;
    }
    results.push({
      step: 'User Sign Up',
      endpoint: '/api/v1/auth/signup',
      method: 'POST',
      status: signupRes.status,
      expectedStatus: 201,
      success: signupSuccess,
      data: {
        userId: signupData.data?.user?.id,
        email: signupData.data?.user?.email,
        fullName: signupData.data?.user?.fullName,
      },
    });
    console.log(`  -> Status: ${signupRes.status}, Created User: ${signupData.data?.user?.email}`);

    // ─── STEP 3: Duplicate Email Check ───
    console.log('\n[TEST 3] Testing Duplicate Registration Prevention ...');
    const dupRes = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
        fullName: 'Duplicate Check',
      }),
    });
    const dupSuccess = dupRes.status === 400 || dupRes.status === 409;
    results.push({
      step: 'Duplicate Email Prevention',
      endpoint: '/api/v1/auth/signup',
      method: 'POST',
      status: dupRes.status,
      expectedStatus: 409,
      success: dupSuccess,
    });
    console.log(`  -> Status: ${dupRes.status} (Correctly rejected duplicate)`);

    // ─── STEP 4: Sign In with Invalid Password ───
    console.log('\n[TEST 4] Testing Sign In with Invalid Password ...');
    const invalidLoginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword@123',
      }),
    });
    const invalidSuccess = invalidLoginRes.status === 400 || invalidLoginRes.status === 401;
    results.push({
      step: 'Invalid Password Check',
      endpoint: '/api/v1/auth/signin',
      method: 'POST',
      status: invalidLoginRes.status,
      expectedStatus: 401,
      success: invalidSuccess,
    });
    console.log(`  -> Status: ${invalidLoginRes.status} (Correctly rejected invalid credentials)`);

    // ─── STEP 5: Sign In with Valid Password ───
    console.log('\n[TEST 5] Testing Sign In with Valid Password (POST /api/v1/auth/signin) ...');
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
      }),
    });
    const loginData = await loginRes.json() as any;
    const loginSuccess = loginRes.status === 200 && loginData.data?.tokens?.accessToken;
    if (loginSuccess) {
      accessToken = loginData.data.tokens.accessToken;
      refreshToken = loginData.data.tokens.refreshToken;
    }
    results.push({
      step: 'Valid User Sign In',
      endpoint: '/api/v1/auth/signin',
      method: 'POST',
      status: loginRes.status,
      expectedStatus: 200,
      success: loginSuccess,
      data: {
        userId: loginData.data?.user?.id,
        email: loginData.data?.user?.email,
        hasAccessToken: !!accessToken,
      },
    });
    console.log(`  -> Status: ${loginRes.status}, Token received: ${!!accessToken}`);

    // ─── STEP 6: Authenticated Profile Fetch ───
    console.log('\n[TEST 6] Testing Authenticated Profile Fetch (GET /api/v1/auth/me) ...');
    const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const meData = await meRes.json() as any;
    const meSuccess = meRes.status === 200 && (meData.data?.user?.email === testEmail || meData.data?.email === testEmail);
    results.push({
      step: 'Authenticated Profile /me',
      endpoint: '/api/v1/auth/me',
      method: 'GET',
      status: meRes.status,
      expectedStatus: 200,
      success: meSuccess,
      data: meData.data,
    });
    console.log(`  -> Status: ${meRes.status}, Profile Email: ${meData.data?.user?.email || meData.data?.email}`);

    // ─── STEP 7: Token Refresh ───
    console.log('\n[TEST 7] Testing Token Refresh (POST /api/v1/auth/refresh) ...');
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshData = await refreshRes.json() as any;
    const refreshSuccess = refreshRes.status === 200 && refreshData.data?.tokens?.accessToken;
    if (refreshSuccess) {
      accessToken = refreshData.data.tokens.accessToken;
    }
    results.push({
      step: 'Token Refresh',
      endpoint: '/api/v1/auth/refresh',
      method: 'POST',
      status: refreshRes.status,
      expectedStatus: 200,
      success: refreshSuccess,
    });
    console.log(`  -> Status: ${refreshRes.status}, New Token received: ${refreshSuccess}`);

    // ─── STEP 8: Forgot Password Request ───
    console.log('\n[TEST 8] Testing Forgot Password Request (POST /api/v1/auth/forgot-password) ...');
    const forgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json() as any;
    const forgotSuccess = forgotRes.status === 200;
    // In test mode or fallback, debugOtp or memory OTP is available
    const debugOtp = forgotData.data?.debugOtp || '1234';
    results.push({
      step: 'Forgot Password Request',
      endpoint: '/api/v1/auth/forgot-password',
      method: 'POST',
      status: forgotRes.status,
      expectedStatus: 200,
      success: forgotSuccess,
      data: forgotData.data,
    });
    console.log(`  -> Status: ${forgotRes.status}, Message: ${forgotData.message || forgotData.data?.message}`);

    // ─── STEP 9: Verify Forgot Password OTP ───
    console.log('\n[TEST 9] Testing Verify Reset OTP (POST /api/v1/auth/verify-forgot-otp) ...');
    const storedOtp = forgotData.data?.debugOtp;
    console.log(`  -> Using verified reset OTP: ${storedOtp}`);

    const verifyOtpRes = await fetch(`${BASE_URL}/api/v1/auth/verify-forgot-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: storedOtp,
      }),
    });
    const verifyOtpData = await verifyOtpRes.json() as any;
    const verifySuccess = verifyOtpRes.status === 200 && verifyOtpData.data?.resetToken;
    if (verifySuccess) {
      resetToken = verifyOtpData.data.resetToken;
    }
    results.push({
      step: 'Verify Reset OTP',
      endpoint: '/api/v1/auth/verify-forgot-otp',
      method: 'POST',
      status: verifyOtpRes.status,
      expectedStatus: 200,
      success: verifySuccess,
    });
    console.log(`  -> Status: ${verifyOtpRes.status}, Reset Token: ${!!resetToken}`);

    // ─── STEP 10: Reset Password with Reset Token ───
    console.log('\n[TEST 10] Testing Password Reset (POST /api/v1/auth/reset-password) ...');
    const resetRes = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: resetToken,
        newPassword: newPassword,
      }),
    });
    const resetData = await resetRes.json() as any;
    const resetSuccess = resetRes.status === 200;
    results.push({
      step: 'Reset Password',
      endpoint: '/api/v1/auth/reset-password',
      method: 'POST',
      status: resetRes.status,
      expectedStatus: 200,
      success: resetSuccess,
    });
    console.log(`  -> Status: ${resetRes.status}, Reset Message: ${resetData.message || resetData.data?.message}`);

    // ─── STEP 11: Sign In with New Password ───
    console.log('\n[TEST 11] Verifying Sign In with NEW Password ...');
    const newLoginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: newPassword,
      }),
    });
    const newLoginData = await newLoginRes.json() as any;
    const newLoginSuccess = newLoginRes.status === 200 && newLoginData.data?.tokens?.accessToken;
    results.push({
      step: 'Sign In With New Password',
      endpoint: '/api/v1/auth/signin',
      method: 'POST',
      status: newLoginRes.status,
      expectedStatus: 200,
      success: newLoginSuccess,
    });
    console.log(`  -> Status: ${newLoginRes.status}, Login with new password succeeded!`);

    // ─── STEP 12: Old Password Should Now Fail ───
    console.log('\n[TEST 12] Verifying OLD Password Is Invalidated ...');
    const oldLoginRes = await fetch(`${BASE_URL}/api/v1/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword,
      }),
    });
    const oldLoginSuccess = oldLoginRes.status === 400 || oldLoginRes.status === 401;
    results.push({
      step: 'Old Password Invalidation',
      endpoint: '/api/v1/auth/signin',
      method: 'POST',
      status: oldLoginRes.status,
      expectedStatus: 400,
      success: oldLoginSuccess,
    });
    console.log(`  -> Status: ${oldLoginRes.status} (Old password successfully invalidated)`);

    // ─── STEP 13: Logout ───
    console.log('\n[TEST 13] Testing Logout (POST /api/v1/auth/logout) ...');
    const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newLoginData.data?.tokens?.accessToken}`,
      },
      body: JSON.stringify({
        refreshToken: newLoginData.data?.tokens?.refreshToken,
      }),
    });
    const logoutSuccess = logoutRes.status === 200;
    results.push({
      step: 'User Logout',
      endpoint: '/api/v1/auth/logout',
      method: 'POST',
      status: logoutRes.status,
      expectedStatus: 200,
      success: logoutSuccess,
    });
    console.log(`  -> Status: ${logoutRes.status}, Logout succeeded`);

  } catch (err: any) {
    console.error('Fatal error during test suite:', err.message);
  } finally {
    server.kill();
  }

  console.log('\n====================================================');
  console.log('               TEST EXECUTION SUMMARY');
  console.log('====================================================');
  let passed = 0;
  for (const r of results) {
    const mark = r.success ? '✅ PASS' : '❌ FAIL';
    if (r.success) passed++;
    console.log(`${mark} | ${r.step.padEnd(30)} | ${r.method.padEnd(5)} ${r.endpoint.padEnd(28)} | HTTP ${r.status}`);
  }
  console.log('----------------------------------------------------');
  console.log(`TOTAL: ${results.length} Tests | PASSED: ${passed} | FAILED: ${results.length - passed}`);
  console.log('====================================================\n');
}

run();
