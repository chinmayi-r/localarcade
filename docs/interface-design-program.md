# Local Arcade interface design program

Status: design plan. No UI or API implementation resumes until the applicable
screen and endpoint contracts pass the review gates below.

This follows [evidence-ranking-api-ux.md](evidence-ranking-api-ux.md). That
document defines product logic; this program turns it into inspectable website,
desktop and API experiences.

# 1. Audiences are modes, not separate products

| Mode | First question | Product response |
|---|---|---|
| Curious newcomer | “What could run on my computer?” | Plain-language hardware and task finder; one safe recommendation plus alternatives |
| Existing local-model user | “Is what I already have configured well?” | Detect/scan, resolve exact configurations, verify owned models and show tuning deltas |
| Workflow specialist | “What works for this repeated coding/RAG/invoice/basic-Q&A job?” | Explicit user-owned workflow, stable facets, harness/evaluator scope, candidate evidence and a portable export when needed |
| Power user | “Show assumptions and let me control runtime/configuration.” | Progressive disclosure of artifact, quant, context, runtime, settings, provenance and evidence channels |
| API integrator | “How do I reproduce and automate the decision?” | Stable resources, plans before mutations, typed errors, idempotency and evidence receipts |

A person may move between modes. “Advanced” is not a permanent account type;
detail appears when their task requires it.

# 2. Reference audit before wireframes

Each reference capture records: product/version/date, source URL, screen/state,
the user problem it solves, what Local Arcade may borrow, what it must avoid,
and whether the image may be redistributed. Images are research references only;
we do not copy product assets or layouts wholesale.

| Reference | Study | Do not inherit |
|---|---|---|
| LM Studio | discovery, download choice, model loading, existing-user chat and developer mode | catalog-first novice overload; implication that Local Arcade is an inference engine |
| llmfit | hardware facts, fit explanations, planning and what-if inputs | raw catalog/table as the default consumer journey; upstream composite as truth |
| Steam Deck Verified | one visible compatibility outcome plus inspectable caveats and ongoing coverage | over-broad badge without exact configuration/evidence scope |
| PCPartPicker | compatibility constraints and recovery from incompatible choices | purchase-oriented clutter and affiliate incentives |
| Postman Collection Runner | named workflows/suites, pre-run configuration, live progress, per-case failures and reruns | exposing every test-run control to ordinary users |
| Stripe API docs | task-based quickstarts, stable resources, typed errors, request IDs and idempotent mutations | payment-domain object names or hidden asynchronous state |
| Docker Desktop | local engine health, inventory, resource use and recoverable diagnostics | infrastructure dashboard as the first consumer screen |

# 3. Screen contract template

Every screen specification must include:

1. audience/mode and user question;
2. entry points and allowed exits;
3. information required versus optional;
4. default state and primary action;
5. exact domain operation/API consumed;
6. side effects and consent boundary;
7. output/state persisted;
8. loading, empty, partial, conflicting, stale, offline, blocked and failure states;
9. novice copy and progressive advanced detail;
10. keyboard/mobile behavior;
11. reference screenshots and explicit borrow/avoid notes;
12. Priya/Marcus/Ravi plus workflow-specialist rehearsal.

# 4. Website screen inventory

The website never detects hardware, scans files, executes a model or claims a
local measurement.

| ID | Screen | Primary question/action | Required output |
|---|---|---|---|
| W0 | Entry choice | “What brought you here?” quick finder, owned-model check, or specific workflow | selected journey; no account wall |
| W1 | Computer | choose exact device/GPU/memory or manual unknowns | self-reported `HardwareTargetV1` with visible uncertainty |
| W2 | Work | broad need or “I have a specific workflow” | seed lane or start W2S |
| W2S | Workflow description | name repeated job; add stable app/project/data/tools/output/verifier facets progressively | user-owned workflow draft; unknown facets remain null |
| W3 | Priorities | patience, context intention, offline/license/download constraints | `RecommendationRequestV1` |
| W4 | Recommendation | one primary setup and why it is safe/relevant | portfolio with familiar anchor, alternative and confidence language |
| W5 | Why/compare | evidence channels, assumptions, exclusions and exact configuration | explanation; no hidden recomputation |
| W6 | What-if | change RAM/VRAM/cores or exact target device | baseline/delta simulation, always estimated |
| W7 | Workflow evidence gap | explain what is known broadly and what is untested for the named workflow | verification options or a portable evidence export—not invented workflow quality |
| W8 | Desktop/export handoff | preview exact fields and intended destination | downloadable vendor-neutral package; no automatic upload |
| W9 | Coverage request | request unsupported hardware/config/task pack | local request or gated contribution path |

# 5. Desktop screen inventory

| ID | Screen | Primary question/action | Required output |
|---|---|---|---|
| D0 | First open | choose quick manual mode or local setup check | chosen path; nothing scanned yet |
| D1 | Permissions | separate hardware detection and model-library scan consent | versioned consent decisions |
| D2 | This computer | detected facts, ambiguity and correction | confirmed/partially confirmed hardware target |
| D3 | Your model library | installed products, artifacts, duplicates and unresolved files | exact/unresolved inventory with recovery actions |
| D4 | Best next step | best owned setup, guided first setup, or evidence gap | one useful action, not a dashboard of zeros |
| D5 | Setup details | exact artifact/runtime/settings, download/source/size if applicable | previewed configuration plan |
| D6 | Verify preview | “Check how this setup runs here”; duration/load/checks/data | immutable authorized measurement plan |
| D7 | Verification progress | stage, cancellation, machine-impact and partial-result behavior | durable progress/partial receipts |
| D8 | Measured result | what happened and what changed in recommendation | separate performance, stability and quick-check evidence |
| D9 | Try it | use the selected model through an existing product/client handoff | connection/config instructions, not a replacement chat app requirement |
| D10 | Private comparison | explicit prompt/suite, two configurations, blind sequential result | local pair/vote with prompt provenance |
| D11 | Specific workflows | named workflows, cases/evaluators, current evidence and gaps | workflow-scoped evidence or a portable export |
| D12 | History/data | runs, receipts, local storage, exports, deletions, contribution previews | inspectable lifecycle control |

# 6. API documentation screen inventory

API design is both a resource contract and a documentation UX.

| ID | Page | Must answer |
|---|---|---|
| P0 | Overview | what Local Arcade does, does not do, hosted versus local capability |
| P1 | Five-minute recommendation | smallest complete request/response with explanation link |
| P2 | Authentication and locality | which calls are local, hosted, authenticated or unavailable |
| P3 | Core resources | hardware target, configuration, workflow, evidence, plan, run, battle, receipt |
| P4 | Recommendation/explanation | priorities, uncertainty, popularity/familiarity and exclusions |
| P5 | Hardware simulation/planning | capacity override versus exact-device replacement and claim limits |
| P6 | Configuration resolution | broad selector/file/provider input to immutable configuration or typed gap |
| P7 | Measurement plans/runs | plan-before-run, consent, async lifecycle, cancellation and receipts |
| P8 | Battles/prompts | allowed prompt sources, private/public state and blind vote lifecycle |
| P9 | Harness experiments | experimental status, held-out protocol, cost/regressions and no-weight claim |
| P10 | Portable evidence export | vendor-neutral import/export scope and why public evidence is not personal certification |
| P11 | Errors/retries | typed codes, recovery actions, dependency failures and idempotency semantics |
| P12 | Versioning/changelog | schema/media versions, deprecations and reproducibility expectations |

Each endpoint page requires: purpose, side effects, permissions, request schema,
minimal and complete examples, response envelope, typed failures, idempotency,
state transitions, provenance fields and links to the corresponding screen.

# 7. Review order

1. Capture and annotate reference screens.
2. Approve W0-W8 as low-fidelity website wireframes.
3. Rehearse newcomer, existing user and workflow specialist through every
   website state.
4. Approve D0-D12 desktop wireframes and permission/side-effect language.
5. Rehearse hardware unknown, empty library, unresolved artifact, failed run,
   contradictory evidence, offline and declined-consent states.
6. Freeze API object/state model.
7. Write P0-P12 documentation with executable request/response fixtures.
8. Confirm each UI screen consumes an API/operation contract and contains no
   duplicate domain logic.
9. Only then select visual styling and implement one thin end-to-end journey.

# 8. Approval gates

UI implementation remains blocked until:

- every screen has one primary user question and action;
- specialist workflows can be explicit without forcing a universal ontology;
- unknown evidence never looks like weak hardware/model quality;
- no execution/upload occurs from navigation alone;
- every failure has a recoverable next action;
- advanced detail is available without becoming novice setup tax;
- the website and desktop do not imply capabilities belonging to the other;
- the portable export is vendor-neutral and does not expose a private downstream product;
- reference comparisons show why Local Arcade is at least as understandable for
  its narrower job.

API implementation remains blocked until:

- resource identities and async state transitions are frozen;
- hosted/local capability negotiation is explicit;
- mutating calls have preview, idempotency and receipt behavior;
- every error has a stable machine code and safe retry rule;
- harness and public evidence cannot become personal certification by import;
- examples pass schema/contract tests.
