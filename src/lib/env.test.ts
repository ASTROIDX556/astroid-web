import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEnvironment } from './env';

test('accepts valid production configuration', () => {
  const config = validateEnvironment({
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: 'https://api.astroid.example',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  });
  assert.equal(config.mockMode, false);
  assert.equal(config.apiUrl, 'https://api.astroid.example');
});

test('rejects missing required production variables without exposing values', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /NEXT_PUBLIC_API_URL/);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
      return true;
    },
  );
});

test('rejects malformed public URLs', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_URL: 'not-a-url',
      }),
    /NEXT_PUBLIC_API_URL/,
  );
});

test('allows development mock mode without an API URL', () => {
  const config = validateEnvironment({ NODE_ENV: 'development' });
  assert.equal(config.mockMode, true);
  assert.equal(config.apiUrl, '');
});

test('allows development with valid API configuration', () => {
  const config = validateEnvironment({
    NODE_ENV: 'development',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
  });
  assert.equal(config.mockMode, false);
});

test('rejects production missing Supabase configuration', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'https://api.astroid.example',
      }),
    /NEXT_PUBLIC_SUPABASE/,
  );
});
