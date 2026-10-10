# Verification evidence

Recorded on October 10, 2026. This records observed behavior, not a claim of event submission or field validation.

## Current evidence

- Real `gemma-4-26b-a4b-it` call through the Gemini API succeeded.
- The browser flow extracted the four fictional example tasks with correct durations, environments and original starts.
- Live NWS data produced a valid original/proposed comparison for October 11 in Miami. In this observed run, outdoor minutes in the selected three hottest hours changed from 150 to 0, with all 150 outdoor task minutes preserved. This is one forecast-dependent example, not a general outcome.
- Real Gemma English and Spanish briefings matched the displayed task times, fixed break, paid shift, and 150 → 0 comparison when reviewed.
- TypeScript and the production build passed.
- 30 focused tests passed, including Nina's synthetic normal, fixed-appointment, no-improvement and impossible-dependency cases.
- Request-origin, oversized-body and tampered-comparison checks passed.
- The browser console reported no errors in the inspected local flow.

## Still being checked

- Final production deployment and its complete live flow.
- A fresh-clone install and production run.
- Repeated model extraction on all five synthetic evaluation inputs.
- Final responsive checks after integration refinements.

## Evidence limits

Synthetic fixtures are used only in the test suite, never in the live app. Evaluation expectations and fixtures remain in the original team files; this document records implementation runs separately. No field interviews, health outcomes, cost savings or model accuracy rate have been established. Crew briefings still require human review.
