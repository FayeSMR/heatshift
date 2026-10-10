import { test } from 'node:test';
import assert from 'node:assert/strict';
import cases from '../examples/evaluation-cases.json';
import { Forecast, Plan, minutes } from '../src/lib/contracts';
import { compare, placementErrors, validatePlan } from '../src/lib/scheduler';
const fixture = cases.forecast_fixtures['SYN-FORECAST-A'];
const forecast: Forecast = {
  date: fixture.date,
  generatedAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  source: 'Synthetic fixture SYN-FORECAST-A; not live NWS',
  location: 'Miami synthetic case',
  timeZone: fixture.timezone,
  hours: fixture.hourly.map((h) => ({
    start: minutes(h.start),
    end: minutes(h.start) + 60,
    apparentF: h.value,
    temperatureF: h.value,
    label: 'Synthetic',
  })),
};
for (const c of cases.cases.filter((c) => ['EVAL-01', 'EVAL-02', 'EVAL-05'].includes(c.id))) {
  test(`Nina ${c.id}: expected metrics and all confirmed constraints`, () => {
    const expected = c.expected.extraction;
    const p: Plan = {
      date: c.input.date,
      shiftStart: c.input.shift.start,
      shiftEnd: c.input.shift.end,
      breakStart: expected.break.start,
      breakEnd: expected.break.end,
      tasks: expected.tasks.map((t) => ({
        id: t.ref,
        title: t.title_meaning,
        duration: t.duration_min!,
        environment: t.environment as 'indoor' | 'outdoor',
        originalStart: 'original_start' in t ? t.original_start : '00:00',
        earliestStart: null,
        latestFinish: null,
        fixedStart: t.fixed_start,
        dependencies: t.depends_on,
      })),
    };
    const r = compare(p, forecast),
      s = c.expected.scheduling;
    assert.equal(r.before.hotMinutes, s.original!.outdoor_min_in_hottest_hours);
    assert.equal(r.after.hotMinutes, s.proposed!.outdoor_min_in_hottest_hours);
    assert.equal(r.before.averageApparentF, s.original!.outdoor_weighted_apparent_temp_f);
    assert.equal(r.after.averageApparentF, s.proposed!.outdoor_weighted_apparent_temp_f);
    assert.equal(r.status, s.outcome);
    assert.deepEqual(placementErrors(p, r.proposed), []);
    if (c.id === 'EVAL-05') assert.deepEqual(r.proposed, r.original);
  });
}
test('Nina EVAL-04: reports the dependency deadline shortfall even though total capacity fits', () => {
  const c = cases.cases.find((c) => c.id === 'EVAL-04')!;
  const p: Plan = {
    date: c.input.date,
    shiftStart: c.input.shift.start,
    shiftEnd: c.input.shift.end,
    breakStart: '12:00',
    breakEnd: '12:30',
    tasks: c.expected.extraction.tasks.map((t, i) => ({
      id: t.ref,
      title: t.title_meaning,
      duration: t.duration_min!,
      environment: t.environment as 'indoor' | 'outdoor',
      originalStart: ['08:00', '10:00', '12:30', '14:30'][i],
      earliestStart: null,
      latestFinish: null,
      fixedStart: t.fixed_start,
      dependencies: t.depends_on,
    })),
  };
  assert.throws(() => validatePlan(p), /Site prep.*10:00.*30 more minutes/);
});
