import { planSchema } from '@/lib/contracts';
import { compare, validatePlan } from '@/lib/scheduler';
import { getForecast } from '@/lib/weather';
import { apiError, readBody, signature } from '@/lib/http';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const plan = planSchema.parse(await readBody(request));
    validatePlan(plan);
    const result = compare(plan, await getForecast(plan.date));
    return Response.json({ result, signature: signature(result) });
  } catch (error) {
    return apiError(error);
  }
}
