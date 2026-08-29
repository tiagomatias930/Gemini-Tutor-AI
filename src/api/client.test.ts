import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, ApiError } from './client';

test('rejects non-API and cross-origin request paths', async () => {
  await assert.rejects(
    () => apiFetch('https://example.com/api/chat'),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_API_PATH',
  );
});

test('always includes browser credentials', async () => {
  const originalFetch = globalThis.fetch;
  let credentials: RequestCredentials | undefined;
  globalThis.fetch = async (_input, init) => {
    credentials = init?.credentials;
    return new Response(null, { status: 204 });
  };
  try {
    await apiFetch('/api/health');
    assert.equal(credentials, 'include');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes structured backend errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'Live disabled', code: 'LIVE_DISABLED' } }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
  try {
    await assert.rejects(
      () => apiFetch('/api/live'),
      (error: unknown) => error instanceof ApiError
        && error.status === 503
        && error.code === 'LIVE_DISABLED'
        && error.message === 'Live disabled',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
