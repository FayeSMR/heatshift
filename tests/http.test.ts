import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBody, signature, verifyResult } from '../src/lib/http';
import { Comparison } from '../src/lib/contracts';
test('same-origin uses the incoming host behind a local reverse proxy', async () => {
  const req = new Request('http://localhost:3000/api/extract', {
    method: 'POST',
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
    body: '{"ok":true}',
  });
  assert.deepEqual(await readBody(req), { ok: true });
});
test('cross-origin and oversized bodies are rejected', async () => {
  await assert.rejects(
    readBody(
      new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { origin: 'https://other.example' },
        body: '{}',
      }),
    ),
    /directly/,
  );
  await assert.rejects(
    readBody(
      new Request('http://localhost/api/extract', { method: 'POST', body: 'x'.repeat(100) }),
      50,
    ),
    /too large/,
  );
});
test('briefing cannot use a client-edited comparison', () => {
  const r = {
    createdAt: new Date().toISOString(),
    before: { hotMinutes: 90 },
    after: { hotMinutes: 0 },
  } as Comparison;
  const signed = signature(r);
  verifyResult(r, signed);
  r.after.hotMinutes = -10;
  assert.throws(() => verifyResult(r, signed), /verified/);
});
