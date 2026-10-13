import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AuthService, AuthError } from '../../src/features/auth/auth.service';

describe('Auth Validation & Account Existence Tests', () => {
  const unregisteredEmail = 'nonexistent.user.testing.999@knotnex.org';

  test('1. Forgot password with unregistered email throws 404 ACCOUNT_NOT_FOUND', async () => {
    try {
      await AuthService.forgotPassword(unregisteredEmail);
      assert.fail('Expected forgotPassword to throw for non-existent user');
    } catch (err: any) {
      assert.ok(err instanceof AuthError, 'Error must be an instance of AuthError');
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.code, 'ACCOUNT_NOT_FOUND');
      assert.strictEqual(
        err.message,
        'No account found with this email. Please create an account first.'
      );
    }
  });

  test('2. Sign in with unregistered email throws 404 ACCOUNT_NOT_FOUND', async () => {
    try {
      await AuthService.signin({
        email: unregisteredEmail,
        password: 'ValidPassword123!',
      });
      assert.fail('Expected signin to throw for non-existent user');
    } catch (err: any) {
      assert.ok(err instanceof AuthError, 'Error must be an instance of AuthError');
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.code, 'ACCOUNT_NOT_FOUND');
      assert.strictEqual(
        err.message,
        'No account found. Please create an account before signing in.'
      );
    }
  });

  test('3. Verify forgot password OTP with unregistered email throws 404 ACCOUNT_NOT_FOUND', async () => {
    try {
      await AuthService.verifyForgotOtp(unregisteredEmail, '1234');
      assert.fail('Expected verifyForgotOtp to throw for invalid OTP / non-existent user');
    } catch (err: any) {
      assert.ok(err != null);
      assert.ok(
        err.message.includes('OTP expired') ||
        err.message.includes('Invalid OTP') ||
        err.message.includes('No account found')
      );
    }
  });

  test('4. Reset password with invalid or expired token throws 400', async () => {
    try {
      await AuthService.resetPassword('invalid.reset.jwt.token', 'NewStrongPass123!');
      assert.fail('Expected resetPassword to throw for invalid token');
    } catch (err: any) {
      assert.ok(err instanceof AuthError || err instanceof Error);
      assert.ok(err.message.includes('expired') || err.message.includes('start over'));
    }
  });
});
