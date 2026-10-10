import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationMs, fahrenheit, localTime, normalizeForecast } from '../src/lib/weather';
const now = Date.parse('2026-10-10T16:00:00Z');
function data() {
  return {
    hourly: {
      properties: {
        generatedAt: '2026-10-10T15:00:00Z',
        periods: [
          {
            startTime: '2026-10-11T08:00:00-04:00',
            endTime: '2026-10-11T09:00:00-04:00',
            temperature: 30,
            temperatureUnit: 'C',
            shortForecast: 'Sunny',
          },
          {
            startTime: '2026-10-11T09:00:00-04:00',
            endTime: '2026-10-11T10:00:00-04:00',
            temperature: 86,
            temperatureUnit: 'F',
            shortForecast: 'Sunny',
          },
        ],
      },
    },
    grid: {
      properties: {
        updateTime: '2026-10-10T15:00:00Z',
        apparentTemperature: {
          uom: 'wmoUnit:degC',
          values: [{ validTime: '2026-10-11T12:00:00+00:00/PT2H', value: 35 }],
        },
      },
    },
  };
}
test('converts explicit units and rejects unknown units', () => {
  assert.equal(fahrenheit(35, 'wmoUnit:degC'), 95);
  assert.equal(fahrenheit(86, 'F'), 86);
  assert.throws(() => fahrenheit(300, 'K'), /unsupported/);
});
test('normalizes Miami local time rather than host time, with daylight saving offsets', () => {
  assert.deepEqual(localTime('2026-10-11T12:00:00Z'), { date: '2026-10-11', minute: 480 });
  assert.deepEqual(localTime('2026-12-11T13:00:00Z'), { date: '2026-12-11', minute: 480 });
});
test('parses multi-hour/day durations without losing coverage', () => {
  assert.equal(durationMs('P1DT2H30M'), 95400000);
  assert.equal(durationMs('PT30M'), 1800000);
  assert.throws(() => durationMs('invalid'));
});
test('joins apparent-temperature intervals to hourly periods and preserves provenance', () => {
  const d = data();
  const f = normalizeForecast('2026-10-11', d.hourly, d.grid, now);
  assert.equal(f.hours.length, 2);
  assert.equal(f.hours[0].apparentF, 95);
  assert.equal(f.hours[0].temperatureF, 86);
  assert.equal(f.hours[1].start, 540);
  assert.equal(f.timeZone, 'America/New_York');
  assert.equal(f.generatedAt, '2026-10-10T15:00:00Z');
});
test('missing interval values remain gaps, never invented', () => {
  const d = data();
  d.grid.properties.apparentTemperature.values[0].validTime = '2026-10-11T12:00:00+00:00/PT1H';
  const f = normalizeForecast('2026-10-11', d.hourly, d.grid, now);
  assert.equal(f.hours.length, 1);
});
test('stale data and missing dates are refused', () => {
  const d = data();
  assert.throws(() => normalizeForecast('2026-10-11', d.hourly, d.grid, now + 86400000), /stale/);
  assert.throws(
    () => normalizeForecast('2026-10-20', d.hourly, d.grid, now),
    /no complete forecast/,
  );
});
