import { createHmac, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { Comparison } from './contracts';
import { PlanError } from './scheduler';
const buckets = new Map<string, { count: number; until: number }>();
export async function readBody(request: Request, limit = 24000) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host))
    throw new PlanError('Use this app directly to submit a work order.');
  const key =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for') ||
    'local';
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const bucket = buckets.get(key) || { count: 0, until: now + 60000 };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > 15) throw new PlanError('Too many requests. Wait one minute and try again.');
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new PlanError('This request is too large. Use a shorter work order.');
  const reader = request.body?.getReader();
  if (!reader) throw new PlanError('A request body is required.');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new PlanError('This request is too large. Use a shorter work order.');
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch {
    throw new PlanError('The request is not valid JSON.');
  }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .slice(0, 4)
          .join(' '),
      },
      { status: 400 },
    );
  return Response.json(
    {
      error:
        error instanceof PlanError
          ? error.message
          : 'The request could not be completed. Please try again.',
    },
    { status: error instanceof PlanError ? 422 : 500 },
  );
}
export function signature(result: Comparison) {
  return createHmac('sha256', process.env.GEMINI_API_KEY || 'local-unconfigured')
    .update('heatshift-result-v1\n' + JSON.stringify(result))
    .digest('hex');
}
export function verifyResult(result: Comparison, provided: string) {
  const expected = signature(result);
  if (
    !/^[a-f0-9]{64}$/.test(provided) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  )
    throw new PlanError('This comparison could not be verified. Compare the schedule again.');
  if (!result.createdAt || Date.now() - Date.parse(result.createdAt) > 2 * 3600000)
    throw new PlanError(
      'This comparison has expired. Refresh the comparison before preparing a briefing.',
    );
}
