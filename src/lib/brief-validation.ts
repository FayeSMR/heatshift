import { Briefing, Comparison, clockTime } from './contracts';
import { PlanError } from './scheduler';
export function validateBriefing(briefing: Briefing, result: Comparison): Briefing {
  const times = new Set([
    result.plan.shiftStart,
    result.plan.shiftEnd,
    result.plan.breakStart,
    result.plan.breakEnd,
    ...result.proposed.flatMap((p) => [clockTime(p.start), clockTime(p.end)]),
  ]);
  for (const language of ['english', 'spanish'] as const) {
    const text = briefing[language];
    const present = new Set(
      (text.match(/\b\d{1,2}:\d{2}\b/g) || []).map((t) => t.padStart(5, '0')),
    );
    if ([...times].some((t) => !present.has(t)) || [...present].some((t) => !times.has(t)))
      throw new PlanError(
        'Gemma’s briefing did not preserve the confirmed times. Prepare the briefing again; the verified schedule is unchanged.',
      );
    for (const n of [result.before.hotMinutes, result.after.hotMinutes])
      if (!new RegExp(`\\b${n}\\b`).test(text))
        throw new PlanError(
          'Gemma’s briefing omitted a comparison value. Prepare it again; the verified schedule is unchanged.',
        );
  }
  return briefing;
}
