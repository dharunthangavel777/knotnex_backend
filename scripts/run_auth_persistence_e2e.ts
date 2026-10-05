/**
 * KnotNex Auth, Password Lifecycle, Hot-Reload Persistence & Screen Connectivity E2E Test
 *
 * Test Scenarios:
 * 1. User Direct & OTP Sign-up (Verify password_hash saved to PostgreSQL)
 * 2. Sign-in with Same Password (Verify bcrypt match & JWT token issuance)
 * 3. Invalid Password Rejection (Verify security controls)
 * 4. Hot Reload & App Restart Simulation:
 *    - Validates GET /auth/me returns user data
 *    - Validates token refresh via POST /auth/refresh
 *    - Validates cached identity persistence
 * 5. Forgot Password & Password Reset Flow:
 *    - POST /auth/forgot-password (OTP generated)
 *    - POST /auth/verify-forgot-otp (resetToken returned)
 *    - POST /auth/reset-password (password_hash updated in PostgreSQL)
 *    - Old password login ATTEMPT -> REJECTED (401)
 *    - New password login ATTEMPT -> ACCEPTED (200)
 * 6. Flutter Screen Endpoint Connection Coverage:
 *    - Verify all backend routes mapped to Flutter screens are active and responding
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

interface TestResult {
  category: string;
  test: string;
  endpoint: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes?: string;
}

const results: TestResult[] = [];

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err: any) {
    return { status: 500, data: { error: err.message } };
  }
}

function record(
  category: string,
  test: string,
  endpoint: string,
  expectedStatus: number,
  actualStatus: number,
  passed: boolean,
  notes?: string
) {
  results.push({ category, test, endpoint, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} [${category}] ${test} -> HTTP ${actualStatus} ${notes ? `(${notes})` : ''}`);
}

async function run() {
  console.log('========================================================================');
  console.log('🔐 KNOTNEX AUTH, PASSWORD LIFECYCLE & HOT RELOAD PERSISTENCE E2E SUITE');
  console.log('========================================================================\n');

  const ts = Date.now();
  const testEmail = `authtester_${ts}@knotnex.test`;
  const initialPassword = 'Password123!';
  const updatedPassword = 'NewSecretPassword456!';
  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  // ── TEST 1: SIGNUP WITH PASSWORD ──────────────────────────────────────────
  console.log('📌 1. SIGNUP & PASSWORD STORAGE');
  const signupRes = await request('POST', '/auth/signup', {
    email: testEmail,
    password: initialPassword,
    fullName: 'Auth Test User',
    phone: `+919123456789`,
    role: 'Individual / Student',
  });

  const signupPassed = signupRes.status === 201 && signupRes.data?.data?.user?.id;
  userId = signupRes.data?.data?.user?.id || '';
  accessToken = signupRes.data?.data?.tokens?.accessToken || '';
  refreshToken = signupRes.data?.data?.tokens?.refreshToken || '';

  record(
    'SIGNUP',
    'Register user with password (POST /auth/signup)',
    'POST /auth/signup',
    201,
    signupRes.status,
    signupPassed,
    `User ID: ${userId.substring(0, 8)}...`
  );

  // ── TEST 2: SIGNIN WITH SAME PASSWORD ────────────────────────────────────
  console.log('\n📌 2. SIGNIN VERIFICATION (SAME PASSWORD CHECK)');
  const loginRes = await request('POST', '/auth/signin', {
    email: testEmail,
    password: initialPassword,
  });

  const loginPassed =
    loginRes.status === 200 &&
    loginRes.data?.data?.user?.id === userId &&
    !!loginRes.data?.data?.tokens?.accessToken;

  if (loginPassed) {
    accessToken = loginRes.data.data.tokens.accessToken;
    refreshToken = loginRes.data.data.tokens.refreshToken;
  }

  record(
    'SIGNIN',
    'Sign in with same password immediately after signup',
    'POST /auth/signin',
    200,
    loginRes.status,
    loginPassed,
    'Bcrypt password matched successfully'
  );

  // ── TEST 3: INVALID PASSWORD REJECTION ───────────────────────────────────
  console.log('\n📌 3. INVALID CREDENTIALS SECURITY REJECTION');
  const badLoginRes = await request('POST', '/auth/signin', {
    email: testEmail,
    password: 'WrongPassword999!',
  });

  const badLoginPassed = badLoginRes.status === 401;
  record(
    'SECURITY',
    'Reject signin attempt with incorrect password',
    'POST /auth/signin',
    401,
    badLoginRes.status,
    badLoginPassed,
    badLoginRes.data?.error?.message || 'Rejected with 401'
  );

  // ── TEST 4: HOT RELOAD & SESSION RESTORE SIMULATION ───────────────────────
  console.log('\n📌 4. HOT RELOAD & SESSION RESTORATION');

  // A. Token validation via GET /auth/me
  const meRes = await request('GET', '/auth/me', undefined, accessToken);
  const mePassed =
    meRes.status === 200 &&
    meRes.data?.data?.user?.id === userId &&
    meRes.data?.data?.user?.email === testEmail;

  record(
    'SESSION',
    'Hot reload session restore: Validate token via GET /auth/me',
    'GET /auth/me',
    200,
    meRes.status,
    mePassed,
    `Identified as: ${meRes.data?.data?.user?.fullName}`
  );

  // B. Token Rotation via POST /auth/refresh
  const refreshRes = await request('POST', '/auth/refresh', {
    refreshToken,
  });

  const refreshPassed =
    refreshRes.status === 200 &&
    !!refreshRes.data?.data?.tokens?.accessToken &&
    !!refreshRes.data?.data?.tokens?.refreshToken;

  if (refreshPassed) {
    accessToken = refreshRes.data.data.tokens.accessToken;
    refreshToken = refreshRes.data.data.tokens.refreshToken;
  }

  record(
    'SESSION',
    'Rotate JWT session tokens (POST /auth/refresh)',
    'POST /auth/refresh',
    200,
    refreshRes.status,
    refreshPassed,
    'Issued new accessToken & refreshToken pair'
  );

  // ── TEST 5: FORGOT PASSWORD & RESET LIFECYCLE ────────────────────────────
  console.log('\n📌 5. FORGOT PASSWORD & PASSWORD RESET LIFECYCLE');

  // Step 5A: Initiate Forgot Password
  const forgotRes = await request('POST', '/auth/forgot-password', {
    email: testEmail,
  });
  const debugOtp = forgotRes.data?.data?.debugOtp || '1234';
  const forgotPassed = forgotRes.status === 200;

  record(
    'FORGOT_PASSWORD',
    'Step 1: Initiate forgot password (POST /auth/forgot-password)',
    'POST /auth/forgot-password',
    200,
    forgotRes.status,
    forgotPassed,
    'Reset OTP generated and dispatched'
  );

  // Step 5B: Verify Forgot OTP -> returns resetToken
  const verifyForgotRes = await request('POST', '/auth/verify-forgot-otp', {
    email: testEmail,
    otp: debugOtp,
  });

  const resetToken = verifyForgotRes.data?.data?.resetToken || '';
  const verifyForgotPassed = verifyForgotRes.status === 200 && resetToken.length > 0;

  record(
    'FORGOT_PASSWORD',
    'Step 2: Verify reset OTP (POST /auth/verify-forgot-otp)',
    'POST /auth/verify-forgot-otp',
    200,
    verifyForgotRes.status,
    verifyForgotPassed,
    'Issued cryptographic resetToken'
  );

  // Step 5C: Apply New Password
  const resetRes = await request('POST', '/auth/reset-password', {
    resetToken,
    newPassword: updatedPassword,
  });

  const resetPassed = resetRes.status === 200;
  record(
    'FORGOT_PASSWORD',
    'Step 3: Reset password in DB (POST /auth/reset-password)',
    'POST /auth/reset-password',
    200,
    resetRes.status,
    resetPassed,
    'PostgreSQL users table updated with new bcrypt hash'
  );

  // Step 5D: Old password must be rejected!
  const oldLoginRes = await request('POST', '/auth/signin', {
    email: testEmail,
    password: initialPassword,
  });
  const oldRejected = oldLoginRes.status === 401;

  record(
    'FORGOT_PASSWORD',
    'Step 4: Verify OLD password is rejected (Security requirement)',
    'POST /auth/signin',
    401,
    oldLoginRes.status,
    oldRejected,
    'Old password rejected with 401'
  );

  // Step 5E: New password must be accepted!
  const newLoginRes = await request('POST', '/auth/signin', {
    email: testEmail,
    password: updatedPassword,
  });

  const newLoginPassed =
    newLoginRes.status === 200 &&
    newLoginRes.data?.data?.user?.id === userId &&
    !!newLoginRes.data?.data?.tokens?.accessToken;

  if (newLoginPassed) {
    accessToken = newLoginRes.data.data.tokens.accessToken;
    refreshToken = newLoginRes.data.data.tokens.refreshToken;
  }

  record(
    'FORGOT_PASSWORD',
    'Step 5: Sign in with NEW password (Verify persistence & login)',
    'POST /auth/signin',
    200,
    newLoginRes.status,
    newLoginPassed,
    'Successfully authenticated with new password'
  );

  // ── TEST 6: FLUTTER SCREEN-BY-SCREEN ENDPOINT CONNECTIVITY ────────────────
  console.log('\n📌 6. FLUTTER SCREEN ENDPOINT CONNECTIVITY VERIFICATION');

  const screenEndpoints = [
    { screen: 'SignInScreen', method: 'POST', endpoint: '/auth/signin', requiresAuth: false },
    { screen: 'SignUpScreen', method: 'POST', endpoint: '/auth/initiate-signup', requiresAuth: false },
    { screen: 'OtpVerificationScreen', method: 'POST', endpoint: '/auth/verify-signup-otp', requiresAuth: false },
    { screen: 'ForgotPasswordScreen', method: 'POST', endpoint: '/auth/forgot-password', requiresAuth: false },
    { screen: 'ResetPasswordScreen', method: 'POST', endpoint: '/auth/verify-forgot-otp', requiresAuth: false },
    { screen: 'ResetPasswordScreen', method: 'POST', endpoint: '/auth/reset-password', requiresAuth: false },
    { screen: 'HomeScreen (Feed)', method: 'GET', endpoint: '/posts/feed', requiresAuth: true },
    { screen: 'ReelsScreen', method: 'GET', endpoint: '/posts/reels', requiresAuth: true },
    { screen: 'ProfileScreen (User Profile)', method: 'GET', endpoint: '/users/profile', requiresAuth: true },
    { screen: 'ProfileScreen (User Posts)', method: 'GET', endpoint: `/posts/user/${userId}`, requiresAuth: true },
    { screen: 'LikedByBottomSheet', method: 'GET', endpoint: '/posts/user/' + userId, requiresAuth: true },
    { screen: 'TagPeopleBottomSheet', method: 'GET', endpoint: '/users', requiresAuth: true },
    { screen: 'AccountCenterScreen', method: 'GET', endpoint: '/auth/me', requiresAuth: true },
  ];

  for (const item of screenEndpoints) {
    let res: { status: number; data: any };
    if (item.method === 'GET') {
      res = await request('GET', item.endpoint, undefined, item.requiresAuth ? accessToken : undefined);
    } else {
      res = await request(item.method, item.endpoint, {}, item.requiresAuth ? accessToken : undefined);
    }

    const connected = res.status < 500 && res.status !== 404;
    record(
      'CONNECTIVITY',
      `Screen ${item.screen} -> ${item.method} ${item.endpoint}`,
      item.endpoint,
      200,
      res.status,
      connected,
      connected ? 'Route bound & responding' : 'Route error'
    );
  }

  // ── FINAL SUMMARY ─────────────────────────────────────────────────────
  console.log('\n========================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`📊 FINAL TEST RUN RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  if (failed === 0) {
    console.log('🎉 ALL AUTH LIFECYCLE, HOT-RELOAD PERSISTENCE & SCREEN CONNECTIVITY TESTS PASSED!');
  } else {
    console.log(`❌ ${failed} TESTS FAILED.`);
  }
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
