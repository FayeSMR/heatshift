import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, placementErrors, validatePlan } from '../src/lib/scheduler';
import { Forecast, Plan, planSchema } from '../src/lib/contracts';
const task = (
  id: string,
  duration: number,
  originalStart: string,
  environment: 'indoor' | 'outdoor',
) => ({
  id,
  title: id,
  duration,
  originalStart,
  environment,
  earliestStart: null,
  latestFinish: null,
  fixedStart: null,
  dependencies: [] as string[],
});
const plan: Plan = {
  date: '2026-10-11',
  shiftStart: '08:00',
  shiftEnd: '16:00',
  breakStart: '12:00',
  breakEnd: '12:30',
  tasks: [
    task('t1', 90, '08:00', 'indoor'),
    task('t2', 90, '09:30', 'indoor'),
    task('t3', 60, '11:00', 'outdoor'),
    task('t4', 90, '12:30', 'outdoor'),
  ],
};
const forecast: Forecast = {
  date: plan.date,
  generatedAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  source: 'test fixture',
  location: 'synthetic test',
  timeZone: 'America/New_York',
  hours: Array.from({ length: 8 }, (_, i) => ({
    start: (i + 8) * 60,
    end: (i + 9) * 60,
    apparentF: [80, 82, 86, 98, 99, 100, 91, 89][i],
    temperatureF: 80,
    label: 'synthetic',
  })),
};
const copy = () => structuredClone(plan);
test('moves the same 150 outdoor minutes out of the hottest hours without altering constraints', () => {
  const r = compare(plan, forecast);
  assert.equal(r.before.hotMinutes, 150);
  assert.equal(r.after.hotMinutes, 0);
  assert.equal(r.after.outdoorMinutes, 150);
  assert.equal(r.status, 'improved');
  assert.deepEqual(placementErrors(plan, r.proposed), []);
  assert.ok(r.candidates > 1);
});
test('all fixed tasks produce an honest unchanged result', () => {
  const p = copy();
  p.tasks.forEach((t) => (t.fixedStart = t.originalStart));
  const r = compare(p, forecast);
  assert.equal(r.status, 'unchanged');
  assert.equal(r.after.hotMinutes, r.before.hotMinutes);
  assert.equal(r.candidates, 1);
});
test('dependency order and earliest/latest bounds survive optimization', () => {
  const p = copy();
  p.tasks[3].dependencies = ['t3'];
  p.tasks[2].earliestStart = '10:00';
  p.tasks[2].latestFinish = '12:00';
  const r = compare(p, forecast);
  assert.deepEqual(placementErrors(p, r.proposed), []);
  assert.ok(
    r.proposed.find((t) => t.id === 't3')!.end <= r.proposed.find((t) => t.id === 't4')!.start,
  );
});
test('contradictory baseline is rejected instead of inventing a before/after', () => {
  const p = copy();
  p.tasks[3].originalStart = '11:30';
  assert.throws(() => compare(p, forecast), /original plan.*break|original plan.*overlap/i);
});
test('insufficient shift capacity is infeasible', () => {
  const p = copy();
  p.tasks[0].duration = 480;
  assert.throws(() => validatePlan(p), /exceed/);
});
test('cycles and unknown dependencies are rejected', () => {
  const p = copy();
  p.tasks[0].dependencies = ['t2'];
  p.tasks[1].dependencies = ['t1'];
  assert.throws(() => validatePlan(p), /cycle/);
  p.tasks[0].dependencies = ['unknown'];
  assert.throws(() => validatePlan(p), /existing/);
});
test('missing forecast hours cannot silently contribute zero exposure', () => {
  assert.throws(
    () => compare(plan, { ...forecast, hours: forecast.hours.filter((h) => h.start !== 660) }),
    /incomplete/,
  );
});
test('indoor-only work never invents an outdoor benefit', () => {
  const p = copy();
  p.tasks.forEach((t) => (t.environment = 'indoor'));
  const r = compare(p, forecast);
  assert.equal(r.status, 'unchanged');
  assert.equal(r.after.outdoorMinutes, 0);
  assert.equal(r.after.averageApparentF, null);
});
test('unchanged temperatures favor original plan to avoid needless changes', () => {
  const f = { ...forecast, hours: forecast.hours.map((h) => ({ ...h, apparentF: 90 })) };
  const p = copy();
  p.tasks.forEach((t) => (t.environment = 'indoor'));
  const r = compare(p, f);
  assert.deepEqual(r.proposed, r.original);
});
test('unsupported precision and unknown task values require confirmation', () => {
  const p = copy();
  p.tasks[0].originalStart = '08:15';
  assert.equal(planSchema.safeParse(p).success, false);
  assert.equal(
    planSchema.safeParse({ ...plan, tasks: [{ ...plan.tasks[0], duration: null }] }).success,
    false,
  );
});
