# HeatShift delivery plan

## Product objective

A Miami landscaping supervisor can enter tomorrow's work order, confirm the tasks, compare two feasible schedules and share a clear crew briefing. The visible proof is a before-and-after timeline that preserves the work and constraints while reducing exposure to the hottest forecast periods when the constraints permit it.

## Scope

- One crew, one Miami location, one date, one paid shift and at most four tasks.
- Task fields: title, duration, indoor/outdoor, earliest start, latest finish, fixed start if applicable, and dependencies.
- Preserve shift boundaries, task durations, breaks, fixed appointments and dependency order.
- Text work orders and English/Spanish briefing output.
- One screen with task review, schedule comparison and crew briefing.
- No authentication, payments, multi-crew routing, automatic messaging, map, image upload or voice interface in the initial build.

## Architecture

```text
Work order
  -> server route -> Gemma 4 extraction -> schema validation
  -> editable task cards -> supervisor confirmation
  -> NWS forecast adapter + deterministic scheduler
  -> original/proposed timelines + computed metrics
  -> server route -> Gemma 4 explanation and crew briefing
```

Keep API keys on the server. Bound task count, input length, request duration and model output size. Validate model responses and return actionable errors. Do not send worker identities or unrelated personal data to the model.

Forecast normalization must explicitly handle America/New_York time, daylight-saving boundaries, units and intervals. Do not interpolate away missing forecast coverage. Preserve source and generation/retrieval timestamps.

## Scheduling and evidence

Use 30-minute placements, rejecting inputs whose timing precision is not supported rather than silently rounding. Enumerate feasible placements for up to four tasks with pruning. Preserve all confirmed constraints and reject overlaps. Use the same workload, shift and constraints for both schedules.

Primary comparison: outdoor minutes in the shift's three hottest forecast hours. Break ties using duration-weighted apparent temperature, then minimize changes to the original plan. If there are fewer than three hours of valid coverage, disclose that limitation and avoid a misleading comparison. Explain the chosen metric in the interface.

The result can legitimately be unchanged or infeasible. Show why, and never manufacture a positive improvement. Report forecast-based exposure metrics, not a guarantee that a shift is safe.

## Delivery sequence

Times are working targets for October 10, 2026, Eastern, not completed milestones. Build closes at 3:30 PM and submission is due at 3:45 PM.

| Target | Deliverable | Acceptance evidence |
| --- | --- | --- |
| By 12:45 PM | Runnable shell and real Gemma extraction | Fresh setup runs; work order becomes editable validated cards using a real API call |
| By 1:35 PM | Forecast adapter and deterministic scheduler | Live NWS data; tests preserve constraints and handle infeasible/no-improvement cases |
| By 2:10 PM | Before/after comparison and bilingual briefing | Full live input-to-result flow; visible computed metric and sourced forecast |
| By 2:40 PM | Deployment and focused validation | Deployed flow works; server keys stay private; errors are clear |
| By 3:15 PM | Documentation and demo rehearsal | Fresh-clone instructions verified; two-minute demo rehearsed; submission checklist complete |
| 3:30–3:45 PM | OrganizerHQ submission | Entry and selected challenges verified; submission receipt retained |

If time contracts, cut optional polish and extra interactions first. The real Gemma API call, valid scheduling, live core flow and public licensed source remain required. A manual-input or fixture fallback may support development and demo resilience but cannot be presented as proof of the required live model integration.

## Verification

- Real Gemma extraction with malformed-output handling and editable confirmation.
- Feasible rescheduling preserves duration, shift, breaks, dependencies and fixed tasks.
- Infeasible input and no-improvement schedules are surfaced accurately.
- Forecast gaps, stale data, API failure and temperature units are handled explicitly.
- Comparison math is independently checked on small known cases.
- Gemma explanations match supplied computed values without introducing new claims.
- English and Spanish briefings are reviewed for consistency.
- Deployed flow and fresh-clone setup are exercised with a real API key.

## Team contribution

Aladdin owns implementation and product decisions. Teammates contribute domain expertise and steering:

- Finance: check operational assumptions, paid-time preservation and a credible value story.
- Creative/marketing: refine the visual narrative and two-minute pitch.
- Social work: check worker-centered wording, accessibility and realistic needs.

Input is welcome throughout; software delivery does not depend on teammates taking development tasks.

## Coordination

Share brief updates in the authorized hackathon WhatsApp group after material milestones or blockers. Check progress about every 15 minutes during the event. Each update should contain verified progress, the next milestone and a specific decision only when needed. Avoid repetitive unchanged updates. Keep development-tool attribution out of product messaging and team updates. Keep required organizer disclosures in the submission workflow.

Group messages are not a substitute for issue status or verified build evidence. Do not publish chat transcripts or private contact information in the public repository.
