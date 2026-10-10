import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import cases from '../examples/evaluation-cases.json';
import { extractTasks } from '../src/lib/gemma';
import { MODEL, planSchema } from '../src/lib/contracts';
async function main() {
  if (!process.argv.includes('--live'))
    throw new Error('Pass --live to make 15 real Gemma calls using the configured API key.');
  await mkdir('work', { recursive: true });
  const results = [];
  const selected = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7);
  casesLoop: for (const c of cases.cases.filter(
    (c) => !selected || selected.split(',').includes(c.id),
  )) {
    for (let run = 1; run <= 3; run++) {
      if (results.length) await delay(10000);
      const shift = {
        shiftStart: c.input.shift.start,
        shiftEnd: c.input.shift.end,
        breakStart: c.expected.extraction.break.start,
        breakEnd: c.expected.extraction.break.end,
      };
      const started = Date.now();
      try {
        const extraction = await extractTasks(c.input.work_order_text, shift);
        const expected = c.expected.extraction.tasks;
        const differences: string[] = [];
        if (extraction.tasks.length !== 4) differences.push('task count');
        extraction.tasks.forEach((t, i) => {
          const e = expected[i];
          if (!e) return;
          if (t.duration !== e.duration_min) differences.push(`task ${i + 1} duration`);
          if (e.environment && t.environment !== e.environment)
            differences.push(`task ${i + 1} environment`);
          if (e.environment === null && t.environment !== 'unknown')
            differences.push(`task ${i + 1} missing environment invented`);
          if (t.fixedStart !== e.fixed_start) differences.push(`task ${i + 1} fixed start`);
          if ('original_start' in e && e.original_start && t.originalStart !== e.original_start)
            differences.push(`task ${i + 1} original start`);
          if (
            JSON.stringify(t.dependencies.map((s) => s.toLowerCase()).sort()) !==
            JSON.stringify(e.depends_on.map((s) => s.toLowerCase()).sort())
          )
            differences.push(`task ${i + 1} dependencies`);
        });
        const ready = planSchema.safeParse({
          date: c.input.date,
          ...shift,
          tasks: extraction.tasks,
        }).success;
        if (c.id === 'EVAL-03' && ready) differences.push('unresolved work order allowed');
        results.push({
          case: c.id,
          run,
          model: MODEL,
          elapsedMs: Date.now() - started,
          differences,
          ready,
          extraction,
        });
        console.log(
          JSON.stringify({ case: c.id, run, differences, ready, elapsedMs: Date.now() - started }),
        );
      } catch (e) {
        results.push({
          case: c.id,
          run,
          error: e instanceof Error ? e.message : 'Failed',
          schemaIssues:
            e instanceof Error && e.cause && typeof e.cause === 'object' && 'issues' in e.cause
              ? e.cause.issues
              : undefined,
        });
        console.log(
          JSON.stringify({ case: c.id, run, error: e instanceof Error ? e.message : 'Failed' }),
        );
        if (e instanceof Error && e.message.includes('quota')) break casesLoop;
      }
    }
  }
  await writeFile(
    selected ? `work/extraction-evaluation-${selected}.json` : 'work/extraction-evaluation.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        model: MODEL,
        syntheticInputs: true,
        realModelCalls: true,
        results,
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error('Evaluation did not complete. Check configuration.');
  process.exitCode = 1;
});
