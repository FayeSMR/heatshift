import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBriefing } from '../src/lib/brief-validation';
import { Briefing, Comparison } from '../src/lib/contracts';
const result = {
  plan: { shiftStart: '08:00', shiftEnd: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  proposed: [{ id: 't1', start: 480, end: 570 }],
  before: { hotMinutes: 90 },
  after: { hotMinutes: 0 },
} as Comparison;
const text = 'Shift 08:00–16:00. Break 12:00–12:30. Task 08:00–09:30. Forecast: 90 to 0 minutes.';
const briefing: Briefing = { summary: 'Task moved earlier.', english: text, spanish: text };
test('briefing preserves all confirmed timestamps and computed values', () => {
  assert.equal(validateBriefing(briefing, result), briefing);
});
test('briefing with an invented time is refused', () => {
  assert.throws(
    () => validateBriefing({ ...briefing, spanish: text.replace('09:30', '10:00') }, result),
    /confirmed times/,
  );
});
test('briefing missing a comparison value is refused', () => {
  assert.throws(
    () => validateBriefing({ ...briefing, english: text.replace('90 to', '80 to') }, result),
    /comparison value/,
  );
});
