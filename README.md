# HeatShift

Plan outdoor work around Miami's hottest hours.

HeatShift helps a landscaping supervisor turn a work order into a practical crew schedule using local weather forecasts. It compares the original plan with an alternative that moves flexible outdoor tasks into cooler forecast windows while preserving task duration, appointments, breaks, dependencies and the paid shift.

**Status:** Project foundation and delivery plan. The application, live model integration and deployment are not implemented yet.

## Planned experience

1. Enter a work order, Miami location, date and shift hours.
2. Gemma 4 extracts task details. The supervisor reviews and corrects every task before scheduling.
3. A deterministic scheduler compares feasible task placements using National Weather Service forecast data.
4. Review the original and proposed timelines, with a transparent forecast exposure comparison.
5. Gemma 4 explains the computed changes and prepares an English or Spanish crew briefing.

The initial scope is one crew, one location, one day and up to four tasks. The supervisor makes the final decision. HeatShift reports forecast exposure, not a medical safety determination or a proven reduction in injuries.

## AI inside the application

Planned model: `gemma-4-26b-a4b-it`, accessed server-side through the Gemini API using Google's official SDK.

Gemma will extract editable task data and explain verified scheduling results. The scheduler will calculate feasibility and comparison metrics in code; model prose will not determine those values. Missing information must be confirmed rather than invented.

Gemma is a runtime application dependency. Its integration must make real API calls and remain visible in the source and demonstration. See [Gemma on the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) and the [Gemma 4 model card and license](https://ai.google.dev/gemma/docs/core/model_card_4). The model's license is separate from this repository's license.

## Data

- [National Weather Service API](https://www.weather.gov/documentation/services-web-api): local hourly forecasts, timestamps and source links.
- [NWS gridpoint documentation](https://weather-gov.github.io/api/gridpoints): apparent temperature and interval-based forecast values.
- User-confirmed task durations, work environment and scheduling constraints.

Display the forecast's age and units. Missing or stale data must be visible. Any saved demonstration fixture must be clearly labeled and must never be presented as a live forecast.

## Development

Planned stack: Next.js, TypeScript, Node.js server routes, the Google Gen AI SDK, and a pure TypeScript scheduling module. No accounts or database are required for the first version.

The runnable application and lockfile will be added in the first implementation milestone. Until then, there are no install or run commands to execute. `.env.example` documents the intended server-side configuration. Never commit a real API key.

Track delivery in [the build plan](docs/BUILD_PLAN.md) and [GitHub issues](https://github.com/NaxeCode/heatshift/issues).

## Hack for Humanity Miami

Primary track: **Four Forces, One City / Fire**. Intended users: Miami outdoor landscaping crews and their supervisors.

The project is being developed toward all three challenges:

- Build for Miami
- Best Open-Source AI Project
- Best Use of Gemma 4

Eligibility depends on the completed implementation and submission requirements. See the [submission checklist](docs/SUBMISSION.md) and [official challenge guide](https://github.com/AI-Collective-Hackathons/hack-for-humanity-miami/blob/main/Challenge%20Guide.md).

Team: Aladdin leads implementation; Faye contributes creative direction and marketing; Nelson contributes worker needs and community-impact expertise; Nina contributes ML product evaluation and product value. See the [team handoffs](docs/BUILD_PLAN.md#team-contribution). The registered submission roster still needs to be verified.

## License

Original project code and documentation are available under the [MIT License](LICENSE). Third-party libraries, data and models retain their own licenses and attribution requirements. The repository will remain public.
