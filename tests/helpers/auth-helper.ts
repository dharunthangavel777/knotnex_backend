import { getStoredOtp } from '../../src/shared/utils/otp.util';
import { TestUserDef } from './test-user';

export const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

export interface ApiResponse<T = any> {
  status: number;
  data: {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  };
  headers: Headers;
  latencyMs: number;
}

export async function requestApi<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: any,
  token?: string,
  bypassRateLimit: boolean = true
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (bypassRateLimit) {
    headers['x-test-bypass-rate-limit'] = 'true';
  }

  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    const latencyMs = performance.now() - start;
    return {
      status: 503,
      data: {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message },
      },
      headers: new Headers(),
      latencyMs,
    };
  }

  const latencyMs = performance.now() - start;
  let json: any = {};
  try {
    json = await response.json();
  } catch {
    json = { success: response.ok, rawText: 'non-json-response' };
  }

  return {
    status: response.status,
    data: json,
    headers: response.headers,
    latencyMs,
  };
}

export async function registerTestUser(user: TestUserDef): Promise<{
  success: boolean;
  user?: any;
  tokens?: { accessToken: string; refreshToken: string };
  error?: string;
}> {
  // 1. Initiate signup
  const initRes = await requestApi('POST', '/auth/initiate-signup', {
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
  });

  if (!initRes.data.success) {
    return { success: false, error: initRes.data.error?.message || 'Initiate signup failed' };
  }

  // 2. Fetch OTP from response or store
  const otp = initRes.data.data?.debugOtp || await getStoredOtp(user.email, 'SIGNUP');
  if (!otp) {
    return { success: false, error: 'OTP was not found in response or storage' };
  }

  // 3. Verify OTP
  const verifyRes = await requestApi('POST', '/auth/verify-signup-otp', {
    email: user.email,
    otp,
  });

  if (!verifyRes.data.success || !verifyRes.data.data?.registrationToken) {
    return { success: false, error: verifyRes.data.error?.message || 'Verify OTP failed' };
  }

  const registrationToken = verifyRes.data.data.registrationToken;

  // 4. Complete signup
  const completeRes = await requestApi('POST', '/auth/complete-signup', {
    registrationToken,
    firebaseIdToken: user.firebaseToken,
  });

  if (!completeRes.data.success) {
    return { success: false, error: completeRes.data.error?.message || 'Complete signup failed' };
  }

  return {
    success: true,
    user: completeRes.data.data?.user,
    tokens: completeRes.data.data?.tokens,
  };
}
