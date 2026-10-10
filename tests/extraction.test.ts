import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewExtraction, normalizeQuestions } from '../src/lib/extraction';
import { Extraction } from '../src/lib/contracts';
const base: Extraction = {
  tasks: [
    {
      id: 't1',
      title: 'Trim palms',
      sourceText: 'Trim palms.',
      sourceLine: 0,
      duration: null,
      environment: 'unknown',
      originalStart: '08:00',
      earliestStart: null,
      latestFinish: null,
      fixedStart: null,
      dependencies: [],
    },
  ],
  questions: [],
};
const shift = { shiftStart: '08:00', shiftEnd: '16:00', breakStart: '12:00', breakEnd: '12:30' };
test('missing source time never becomes a made-up shift-start appointment', () => {
  const r = reviewExtraction(base, 'Trim palms.', shift);
  assert.equal(r.tasks[0].originalStart, null);
  assert.ok(r.questions.some((q) => q.includes('how many minutes')));
  assert.ok(r.questions.some((q) => q.includes('indoors or outdoors')));
});
test('model question objects preserve their meaning as readable text', () => {
  assert.deepEqual(
    normalizeQuestions({ questions: [{ task: 'Prep', question: 'Which duration?' }] }),
    { questions: ['Prep: Which duration?'] },
  );
});
test('unsupported duration is retained and flagged, never rounded', () => {
  const r = reviewExtraction(
    { ...base, tasks: [{ ...base.tasks[0], duration: 45 }] },
    'Trim palms.',
    shift,
  );
  assert.equal(r.tasks[0].duration, 45);
  assert.ok(r.questions.some((q) => q.includes('45 minutes')));
});
test('verbatim timed source preserves the explicit original start', () => {
  const source = '08:00–09:00 Trim palms, outdoors.';
  const r = reviewExtraction(
    {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          sourceText: source,
          originalStart: '08:00',
          duration: 60,
          environment: 'outdoor',
        },
      ],
    },
    source,
    shift,
  );
  assert.equal(r.tasks[0].originalStart, '08:00');
  assert.equal(r.questions.length, 0);
});

test('numbered source citations copy original text rather than model paraphrases', () => {
  const source = 'Crew plan\n08:00–09:00 Trim palms, outdoors.';
  const r = reviewExtraction(
    {
      ...base,
      tasks: [
        {
          ...base.tasks[0],
          sourceLine: 2,
          sourceText: 'rewritten text',
          duration: 60,
          environment: 'outdoor',
        },
      ],
    },
    source,
    shift,
  );
  assert.equal(r.tasks[0].sourceText, '08:00–09:00 Trim palms, outdoors.');
  assert.equal(r.tasks[0].originalStart, '08:00');
  assert.equal(r.questions.length, 0);
});
