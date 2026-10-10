import { z } from 'zod';
import { generateBriefing } from '@/lib/gemma';
import { apiError, readBody, verifyResult } from '@/lib/http';
import { Comparison, MODEL } from '@/lib/contracts';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = z
      .object({ result: z.record(z.string(), z.unknown()), signature: z.string() })
      .parse(await readBody(request, 48000));
    const result = body.result as Comparison;
    verifyResult(result, body.signature);
    return Response.json({ briefing: await generateBriefing(result), model: MODEL });
  } catch (error) {
    return apiError(error);
  }
}
