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

test('production requires only the API URL, not Supabase credentials', () => {
  const config = validateEnvironment({
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: 'https://api.astroid.example',
  });
  assert.equal(config.mockMode, false);
  assert.equal(config.supabaseUrl, '');
  assert.equal(config.supabaseAnonKey, '');
});

test('rejects missing required production variables without exposing values', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /NEXT_PUBLIC_API_URL/);
      assert.doesNotMatch(error.message, /NEXT_PUBLIC_SUPABASE/);
      return true;
    },
  );
});

test('production build phase may run without any configuration', () => {
  const config = validateEnvironment({
    NODE_ENV: 'production',
    NEXT_PHASE: 'phase-production-build',
  });
  assert.equal(config.mockMode, true);
  assert.equal(config.apiUrl, '');
  assert.equal(config.supabaseUrl, '');
});

test('production build phase still rejects malformed URLs', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        NEXT_PHASE: 'phase-production-build',
        NEXT_PUBLIC_API_URL: 'not-a-url',
      }),
    /NEXT_PUBLIC_API_URL/,
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

  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      }),
    /NEXT_PUBLIC_SUPABASE_URL/,
  );
});

test('a partial Supabase configuration is tolerated and disables realtime', () => {
  const urlOnly = validateEnvironment({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  });
  assert.equal(urlOnly.supabaseUrl, 'https://project.supabase.co');
  assert.equal(urlOnly.supabaseAnonKey, '');

  const keyOnly = validateEnvironment({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  });
  assert.equal(keyOnly.supabaseUrl, '');
  assert.equal(keyOnly.supabaseAnonKey, 'public-anon-key');
});

test('production server runtime still requires the API URL', () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        NEXT_PHASE: 'phase-production-server',
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
