import { z } from 'zod';

export const MODEL = 'gemma-4-26b-a4b-it';
export const ZONE = 'America/New_York';
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/, 'Use 30-minute increments.');
const maybeClock = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
export const draftTaskSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,20}$/),
  title: z.string().min(1).max(100),
  sourceText: z.string().max(2000).default(''),
  duration: z.number().int().min(1).max(1440).nullable(),
  environment: z.enum(['outdoor', 'indoor', 'unknown']),
  originalStart: maybeClock,
  earliestStart: maybeClock,
  latestFinish: maybeClock,
  fixedStart: maybeClock,
  dependencies: z.array(z.string().max(20)).max(3),
});
export const extractionSchema = z.object({
  tasks: z.array(draftTaskSchema).min(1).max(4),
  questions: z.array(z.string().min(1).max(1000)).max(24),
});
export const taskSchema = draftTaskSchema.omit({ sourceText: true }).extend({
  duration: z.number().int().min(30).max(480).multipleOf(30),
  environment: z.enum(['outdoor', 'indoor']),
  originalStart: clock,
  earliestStart: clock.nullable(),
  latestFinish: clock.nullable(),
  fixedStart: clock.nullable(),
});
export const planSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftStart: clock,
  shiftEnd: clock,
  breakStart: clock,
  breakEnd: clock,
  tasks: z.array(taskSchema).min(1).max(4),
});
export type DraftTask = z.infer<typeof draftTaskSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type Hour = {
  start: number;
  end: number;
  apparentF: number;
  temperatureF: number;
  label: string;
};
export type Forecast = {
  date: string;
  hours: Hour[];
  generatedAt: string;
  fetchedAt: string;
  source: string;
  location: string;
  timeZone: string;
};
export type Placement = { id: string; start: number; end: number };
export type Metrics = {
  hotMinutes: number;
  averageApparentF: number | null;
  outdoorMinutes: number;
};
export type Comparison = {
  plan: Plan;
  forecast: Forecast;
  original: Placement[];
  proposed: Placement[];
  hottestHours: Hour[];
  before: Metrics;
  after: Metrics;
  status: 'improved' | 'alternative' | 'unchanged';
  candidates: number;
  createdAt: string;
};
export const briefingSchema = z.object({
  summary: z.string().min(1).max(600),
  english: z.string().min(1).max(1800),
  spanish: z.string().min(1).max(1800),
});
export type Briefing = z.infer<typeof briefingSchema>;
export function minutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function clockTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
export function displayTime(minute: number) {
  const h = Math.floor(minute / 60);
  return `${h % 12 || 12}${minute % 60 ? ':' + String(minute % 60).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
}
export function miamiDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
export const SAMPLE = `Miami landscaping crew. Paid shift 08:00–16:00, fixed break 12:00–12:30.
Original plan:
08:00–09:30: Inventory and check tools, indoors.
09:30–11:00: Load and sort supplies in indoor storage.
11:00–12:00: Prune hedges, outdoors.
12:30–14:00: Mow the lawn, outdoors.
All four tasks are flexible within the shift. No dependencies or fixed appointments. Preserve every task duration, the break and the full paid shift. Unallocated time remains paid availability.`;
