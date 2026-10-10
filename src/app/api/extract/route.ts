import { z } from 'zod';
import { extractTasks } from '@/lib/gemma';
import { apiError, readBody } from '@/lib/http';
import { MODEL } from '@/lib/contracts';
export const runtime = 'nodejs';
export const maxDuration = 60;
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/);
const schema = z.object({
  workOrder: z.string().trim().min(20).max(6000),
  shiftStart: clock,
  shiftEnd: clock,
  breakStart: clock,
  breakEnd: clock,
});
export async function POST(request: Request) {
  try {
    const { workOrder, ...shift } = schema.parse(await readBody(request));
    return Response.json({ ...(await extractTasks(workOrder, shift)), model: MODEL });
  } catch (error) {
    return apiError(error);
  }
}
