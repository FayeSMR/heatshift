import { Comparison, Forecast, Hour, Metrics, Placement, Plan, Task, minutes } from './contracts';

export class PlanError extends Error {}
const overlaps = (a: Placement, b: Placement) => a.start < b.end && b.start < a.end;
function bounds(plan: Plan, task: Task) {
  return {
    start: Math.max(minutes(plan.shiftStart), task.earliestStart ? minutes(task.earliestStart) : 0),
    end: Math.min(minutes(plan.shiftEnd), task.latestFinish ? minutes(task.latestFinish) : 1440),
  };
}
export function validatePlan(plan: Plan) {
  const start = minutes(plan.shiftStart),
    end = minutes(plan.shiftEnd);
  const bs = minutes(plan.breakStart),
    be = minutes(plan.breakEnd);
  if (end <= start || end - start > 960)
    throw new PlanError('Use a same-day shift lasting at most 16 hours.');
  if (bs < start || be > end || be <= bs)
    throw new PlanError('The break must be inside the shift, with an end after its start.');
  if (plan.tasks.reduce((n, t) => n + t.duration, 0) > end - start - (be - bs))
    throw new PlanError(
      'The work and break exceed the paid shift. Adjust the confirmed workload or shift.',
    );
  const ids = new Set(plan.tasks.map((t) => t.id));
  if (ids.size !== plan.tasks.length) throw new PlanError('Task identifiers must be unique.');
  for (const task of plan.tasks) {
    const b = bounds(plan, task);
    if (b.end - b.start < task.duration)
      throw new PlanError(`${task.title}: its allowed window is shorter than the task.`);
    if (task.dependencies.some((id) => id === task.id || !ids.has(id)))
      throw new PlanError(`${task.title}: select another existing task as a dependency.`);
  }
  const visited = new Set<string>(),
    active = new Set<string>();
  function visit(id: string) {
    if (active.has(id))
      throw new PlanError('Dependencies form a cycle. Remove the conflicting dependency.');
    if (visited.has(id)) return;
    active.add(id);
    plan.tasks.find((t) => t.id === id)!.dependencies.forEach(visit);
    active.delete(id);
    visited.add(id);
  }
  plan.tasks.forEach((t) => visit(t.id));
  const finishes = new Map<string, number>();
  function earliestFinish(task: Task): number {
    if (finishes.has(task.id)) return finishes.get(task.id)!;
    const dependencies = task.dependencies.map((id) => plan.tasks.find((t) => t.id === id)!);
    let s = Math.max(bounds(plan, task).start, ...dependencies.map(earliestFinish));
    if (task.fixedStart && s > minutes(task.fixedStart))
      throw new PlanError(
        `${dependencies.map((t) => t.title).join(', ') || task.title} cannot finish before ${task.title}'s fixed start at ${task.fixedStart}. At least ${s - minutes(task.fixedStart)} more minutes are needed. Change the appointment or confirmed workload.`,
      );
    if (task.fixedStart) s = minutes(task.fixedStart);
    if (s < be && s + task.duration > bs) {
      if (task.fixedStart)
        throw new PlanError(`${task.title}'s fixed appointment overlaps the break.`);
      s = be;
    }
    if (s + task.duration > bounds(plan, task).end)
      throw new PlanError(
        `${task.title} cannot finish within its allowed window after its dependencies and the break.`,
      );
    finishes.set(task.id, s + task.duration);
    return s + task.duration;
  }
  plan.tasks.forEach(earliestFinish);
}
export function placementErrors(plan: Plan, placements: Placement[]): string[] {
  const errors: string[] = [];
  const pause = { id: 'break', start: minutes(plan.breakStart), end: minutes(plan.breakEnd) };
  for (const t of plan.tasks) {
    const p = placements.find((p) => p.id === t.id),
      b = bounds(plan, t);
    if (!p) {
      errors.push(`${t.title}: missing placement.`);
      continue;
    }
    if (p.end - p.start !== t.duration || p.start < b.start || p.end > b.end)
      errors.push(`${t.title}: outside its allowed time window.`);
    if (t.fixedStart && p.start !== minutes(t.fixedStart))
      errors.push(`${t.title}: does not match its fixed appointment.`);
    if (overlaps(p, pause)) errors.push(`${t.title}: overlaps the fixed break.`);
    if (
      t.dependencies.some((id) => {
        const dep = placements.find((p) => p.id === id);
        return !dep || dep.end > p.start;
      })
    )
      errors.push(`${t.title}: begins before a dependency is complete.`);
  }
  for (let i = 0; i < placements.length; i++)
    for (let j = i + 1; j < placements.length; j++)
      if (overlaps(placements[i], placements[j]))
        errors.push('Two tasks overlap. One crew can do one task at a time.');
  return [...new Set(errors)];
}
function overlapMinutes(p: Placement, h: Hour) {
  return Math.max(0, Math.min(p.end, h.end) - Math.max(p.start, h.start));
}
export function metrics(
  plan: Plan,
  placements: Placement[],
  hours: Hour[],
  hottest: Hour[],
): Metrics {
  let hotMinutes = 0,
    weighted = 0,
    outdoorMinutes = 0;
  for (const task of plan.tasks.filter((t) => t.environment === 'outdoor')) {
    const p = placements.find((p) => p.id === task.id)!;
    hotMinutes += hottest.reduce((n, h) => n + overlapMinutes(p, h), 0);
    weighted += hours.reduce((n, h) => n + overlapMinutes(p, h) * h.apparentF, 0);
    outdoorMinutes += task.duration;
  }
  return {
    hotMinutes,
    averageApparentF: outdoorMinutes ? Math.round((weighted / outdoorMinutes) * 10) / 10 : null,
    outdoorMinutes,
  };
}
export function compare(plan: Plan, forecast: Forecast): Comparison {
  validatePlan(plan);
  if (forecast.date !== plan.date)
    throw new PlanError('The forecast date does not match the planned work date.');
  const start = minutes(plan.shiftStart),
    end = minutes(plan.shiftEnd);
  const hours = forecast.hours
    .filter((h) => h.end > start && h.start < end)
    .sort((a, b) => a.start - b.start);
  for (let m = start; m < end; m += 30)
    if (!hours.some((h) => h.start <= m && h.end >= m + 30))
      throw new PlanError(
        'Forecast coverage is incomplete for this shift. Choose a date and shift fully covered by NWS.',
      );
  if (hours.length < 3)
    throw new PlanError('A comparison needs at least three forecast hours within the shift.');
  const hottestHours = [...hours]
    .sort((a, b) => b.apparentF - a.apparentF || a.start - b.start)
    .slice(0, 3)
    .sort((a, b) => a.start - b.start);
  const original = plan.tasks.map((t) => ({
    id: t.id,
    start: minutes(t.originalStart),
    end: minutes(t.originalStart) + t.duration,
  }));
  const errors = placementErrors(plan, original);
  if (errors.length)
    throw new PlanError(`Fix the original plan before comparing: ${errors.join(' ')}`);
  const before = metrics(plan, original, hours, hottestHours);
  const score = (placements: Placement[]) => {
    const m = metrics(plan, placements, hours, hottestHours);
    const weighted = plan.tasks
      .filter((t) => t.environment === 'outdoor')
      .reduce(
        (n, t) =>
          n +
          hours.reduce(
            (s, h) => s + overlapMinutes(placements.find((p) => p.id === t.id)!, h) * h.apparentF,
            0,
          ),
        0,
      );
    return [
      m.hotMinutes,
      weighted,
      placements.filter((p) => p.start !== original.find((o) => o.id === p.id)!.start).length,
      placements.reduce(
        (n, p) => n + Math.abs(p.start - original.find((o) => o.id === p.id)!.start),
        0,
      ),
    ];
  };
  let best = [...original],
    bestScore = score(best),
    candidates = 0;
  const options = new Map(
    plan.tasks.map((t) => {
      const b = bounds(plan, t),
        options: Placement[] = [];
      for (let s = b.start; s + t.duration <= b.end; s += 30) {
        const p = { id: t.id, start: s, end: s + t.duration };
        if (
          (!t.fixedStart || s === minutes(t.fixedStart)) &&
          !overlaps(p, {
            id: 'break',
            start: minutes(plan.breakStart),
            end: minutes(plan.breakEnd),
          })
        )
          options.push(p);
      }
      return [t.id, options];
    }),
  );
  const ordered = [...plan.tasks].sort(
    (a, b) => options.get(a.id)!.length - options.get(b.id)!.length,
  );
  function search(i: number, placed: Placement[]) {
    if (i === ordered.length) {
      candidates++;
      const s = score(placed);
      if (
        s[0] < bestScore[0] ||
        (s[0] === bestScore[0] &&
          (s[1] < bestScore[1] - 0.001 ||
            (Math.abs(s[1] - bestScore[1]) < 0.001 &&
              (s[2] < bestScore[2] || (s[2] === bestScore[2] && s[3] < bestScore[3])))))
      ) {
        best = [...placed];
        bestScore = s;
      }
      return;
    }
    const task = ordered[i];
    for (const p of options.get(task.id)!) {
      if (placed.some((q) => overlaps(p, q))) continue;
      if (
        placed.some(
          (q) =>
            (task.dependencies.includes(q.id) && q.end > p.start) ||
            (plan.tasks.find((t) => t.id === q.id)!.dependencies.includes(task.id) &&
              p.end > q.start),
        )
      )
        continue;
      search(i + 1, [...placed, p]);
    }
  }
  search(0, []);
  const proposed = best.sort((a, b) => a.start - b.start);
  if (placementErrors(plan, proposed).length)
    throw new PlanError('The schedule could not be verified. Review the task constraints.');
  const after = metrics(plan, proposed, hours, hottestHours);
  return {
    plan,
    forecast,
    original,
    proposed,
    hottestHours,
    before,
    after,
    status:
      bestScore[0] < before.hotMinutes
        ? 'improved'
        : bestScore[1] < score(original)[1] - 0.001
          ? 'alternative'
          : 'unchanged',
    candidates,
    createdAt: new Date().toISOString(),
  };
}
