import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  Comparison,
  Extraction,
  SAMPLE,
  miamiDate,
  MODEL,
  briefingSchema,
  planSchema,
} from '../src/lib/contracts';
import { placementErrors } from '../src/lib/scheduler';
const base = process.env.HEATSHIFT_BASE_URL || 'http://127.0.0.1:3000';
async function post(path: string, body: unknown) {
  const r = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(base).origin },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`${path}: ${data.error || r.status}`);
  return data;
}
async function main() {
  const shift = { shiftStart: '08:00', shiftEnd: '16:00', breakStart: '12:00', breakEnd: '12:30' };
  const extraction: Extraction & { model: string } = await post('/api/extract', {
    ...shift,
    workOrder: SAMPLE,
  });
  assert.equal(extraction.model, MODEL);
  assert.equal(extraction.tasks.length, 4);
  const plan = planSchema.parse({ date: miamiDate(1), ...shift, tasks: extraction.tasks });
  const envelope: { result: Comparison; signature: string } = await post('/api/plan', plan);
  assert.deepEqual(placementErrors(plan, envelope.result.proposed), []);
  assert.equal(envelope.result.before.outdoorMinutes, envelope.result.after.outdoorMinutes);
  const reply = await post('/api/brief', envelope);
  briefingSchema.parse(reply.briefing);
  assert.equal(reply.model, MODEL);
  const invalid = await fetch(new URL('/api/brief', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...envelope, signature: '0'.repeat(64) }),
  });
  assert.equal(invalid.status, 422);
  await mkdir('work', { recursive: true });
  await writeFile(
    'work/live-smoke.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        base,
        model: MODEL,
        extraction,
        result: envelope.result,
        briefing: reply.briefing,
        tamperRejected: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      base,
      model: MODEL,
      taskCount: extraction.tasks.length,
      forecastIssuedAt: envelope.result.forecast.generatedAt,
      status: envelope.result.status,
      beforeHotMinutes: envelope.result.before.hotMinutes,
      afterHotMinutes: envelope.result.after.hotMinutes,
      briefingLanguages: ['en', 'es'],
      tamperRejected: true,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
