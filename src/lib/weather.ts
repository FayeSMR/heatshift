import { Forecast, Hour, ZONE } from './contracts';
import { PlanError } from './scheduler';
export const HOURLY_URL = 'https://api.weather.gov/gridpoints/MFL/110,50/forecast/hourly';
export const GRID_URL = 'https://api.weather.gov/gridpoints/MFL/110,50';
type Interval = { validTime: string; value: number | null };
export function fahrenheit(value: number, unit: string) {
  if (!Number.isFinite(value)) throw new PlanError('The forecast contains an invalid temperature.');
  if (['F', 'wmoUnit:degF'].includes(unit)) return value;
  if (['C', 'wmoUnit:degC'].includes(unit)) return (value * 9) / 5 + 32;
  throw new PlanError('The forecast uses an unsupported temperature unit.');
}
export function durationMs(iso: string) {
  const m =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      iso,
    );
  if (!m) throw new PlanError('The forecast contains an unsupported time interval.');
  return ((+(m[1] || 0) * 24 + +(m[2] || 0)) * 60 * 60 + +(m[3] || 0) * 60 + +(m[4] || 0)) * 1000;
}
export function localTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()))
    throw new PlanError('The forecast contains an invalid timestamp.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: +p.hour * 60 + +p.minute };
}
export function normalizeForecast(
  date: string,
  hourly: any,
  grid: any,
  now = Date.now(),
): Forecast {
  const hourlyTime = hourly.properties?.generatedAt;
  const gridTime = grid.properties?.updateTime;
  if (!gridTime || !Number.isFinite(Date.parse(gridTime)))
    throw new PlanError('NWS did not supply a valid apparent-temperature timestamp.');
  const generatedAt = Date.parse(gridTime) < Date.parse(hourlyTime) ? gridTime : hourlyTime;
  if (!generatedAt || !Number.isFinite(Date.parse(generatedAt)))
    throw new PlanError('NWS did not supply a valid forecast timestamp.');
  if (
    now - Date.parse(generatedAt) > 12 * 3600000 ||
    [gridTime, hourlyTime].some((t) => Date.parse(t) > now + 3600000)
  )
    throw new PlanError(
      'The NWS forecast timestamp is stale or invalid. Try again when a fresh forecast is available.',
    );
  const apparent = grid.properties?.apparentTemperature;
  if (!apparent?.values?.length)
    throw new PlanError(
      'NWS apparent-temperature data is unavailable. No comparison was generated.',
    );
  const intervals = apparent.values.map((v: Interval) => {
    const [s, d] = v.validTime.split('/');
    return { start: Date.parse(s), end: Date.parse(s) + durationMs(d), value: v.value };
  });
  const hours: Hour[] = [];
  for (const p of hourly.properties.periods || []) {
    const local = localTime(p.startTime);
    if (local.date !== date) continue;
    const s = Date.parse(p.startTime),
      e = Date.parse(p.endTime);
    if (e - s !== 3600000 || local.minute % 60)
      throw new PlanError('NWS hourly boundaries are unsupported for this date.');
    const a = intervals.find(
      (v: { start: number; end: number; value: number | null }) =>
        v.start <= s && v.end >= e && v.value !== null,
    );
    if (!a) continue;
    if (hours.some((h) => h.start === local.minute))
      throw new PlanError(
        'This daylight-saving date repeats a local hour. Choose a shift on another date.',
      );
    const endLocal = localTime(p.endTime);
    if (endLocal.date === date && endLocal.minute !== local.minute + 60)
      throw new PlanError(
        'This daylight-saving transition cannot be scheduled reliably. Choose another date.',
      );
    hours.push({
      start: local.minute,
      end: local.minute + 60,
      apparentF: fahrenheit(a.value, apparent.uom),
      temperatureF: fahrenheit(p.temperature, p.temperatureUnit),
      label: p.shortForecast || '',
    });
  }
  if (!hours.length)
    throw new PlanError(
      'NWS has no complete forecast for that date. Choose today or a date in the next few days.',
    );
  return {
    date,
    hours: hours.sort((a, b) => a.start - b.start),
    generatedAt,
    fetchedAt: new Date(now).toISOString(),
    source: GRID_URL,
    location: 'Miami, FL · 25.7617, −80.1918',
    timeZone: ZONE,
  };
}
export async function getForecast(date: string) {
  const headers = {
    'User-Agent': process.env.NWS_USER_AGENT || 'HeatShift (https://github.com/NaxeCode/heatshift)',
    Accept: 'application/geo+json',
  };
  try {
    const responses = await Promise.all(
      [HOURLY_URL, GRID_URL].map((url) =>
        fetch(url, { headers, signal: AbortSignal.timeout(12000), next: { revalidate: 300 } }),
      ),
    );
    if (responses.some((r) => !r.ok))
      throw new PlanError(
        'NWS is temporarily unavailable. Try again shortly; no weather values were invented.',
      );
    const [hourly, grid] = await Promise.all(responses.map((r) => r.json()));
    return normalizeForecast(date, hourly, grid);
  } catch (error) {
    if (error instanceof PlanError) throw error;
    throw new PlanError(
      'The weather request timed out or failed. Check the connection and try again.',
    );
  }
}
