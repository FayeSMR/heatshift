import { Extraction, minutes } from './contracts';

// Some valid model responses encode a question as a labeled object. Preserve its text.
export function normalizeQuestions(value: unknown): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    !('questions' in value) ||
    !Array.isArray(value.questions)
  )
    return value;
  return {
    ...value,
    questions: value.questions.map((q) =>
      q && typeof q === 'object' && !Array.isArray(q)
        ? Object.values(q)
            .filter((v) => typeof v === 'string')
            .join(': ')
        : q,
    ),
  };
}
export function reviewExtraction(
  extraction: Extraction,
  workOrder: string,
  shift: { shiftStart: string; shiftEnd: string },
) {
  const questions = new Set(extraction.questions);
  const normalized = workOrder.replace(/\s+/g, ' ').trim();
  const tasks = extraction.tasks.map((task) => {
    const t = { ...task };
    const source = t.sourceText.replace(/\s+/g, ' ').trim();
    const explicitTime = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:am|pm)\b/i.test(source);
    if (!source || !normalized.includes(source) || !explicitTime) {
      t.originalStart = null;
      questions.add(
        `${t.title}: confirm the original start time; it could not be tied to an explicit time in this task's source.`,
      );
    }
    if (source && !normalized.includes(source)) {
      t.sourceText = '';
      questions.add(
        `${t.title}: the source excerpt could not be verified. Check every extracted field against your work order.`,
      );
    }
    if (t.duration === null) questions.add(`${t.title}: how many minutes does this task take?`);
    else if (t.duration % 30 !== 0 || t.duration > 480)
      questions.add(
        `${t.title}: the stated ${t.duration} minutes is unsupported. Confirm a duration in 30-minute steps, up to 480 minutes; nothing was rounded.`,
      );
    if (t.environment === 'unknown')
      questions.add(`${t.title}: confirm whether the work is indoors or outdoors.`);
    for (const [label, value] of Object.entries({
      originalStart: t.originalStart,
      earliestStart: t.earliestStart,
      latestFinish: t.latestFinish,
      fixedStart: t.fixedStart,
    })) {
      if (value && minutes(value) % 30 !== 0)
        questions.add(`${t.title}: ${label} ${value} needs confirmation on a 30-minute boundary.`);
    }
    if (
      t.originalStart &&
      t.duration &&
      (minutes(t.originalStart) < minutes(shift.shiftStart) ||
        minutes(t.originalStart) + t.duration > minutes(shift.shiftEnd))
    )
      questions.add(
        `${t.title}: the original task time extends outside the confirmed shift. Resolve the conflict before comparing.`,
      );
    return t;
  });
  return { tasks, questions: [...questions].slice(0, 24) };
}
