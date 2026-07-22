# Local Arcade UI reference audit and screen-plan method

Status: design research. No UI implementation is authorized by this document.

This is the bridge between architectural contracts and wireframes. The current
workflow diagrams are not sufficient to build the website or desktop app.
Every user-facing state must be designed screen by screen, and every API
operation endpoint by endpoint, before implementation resumes.

## Reference-image policy

Use current official product pages and documentation screenshots during the
design review. Link to them; do not copy third-party screenshots into this
repository without a license permitting redistribution. Record the interaction
pattern being studied, not a visual imitation.

## Reference products

| Product | Screens/patterns to inspect | Borrow | Avoid |
|---|---|---|---|
| [LM Studio](https://lmstudio.ai/docs/app/basics) | Discover, model loader, chat, developer/server, installed models | clear separation of discovering, loading, using and serving; advanced configuration available at the moment it matters | exposing model catalog terminology before the person has a goal; treating a successful load as proof of workflow quality |
| [PCPartPicker](https://pcpartpicker.com/list/) | incremental component selection, compatibility result, warnings/notes, shareable build | constraints update while a choice is composed; problems point to the exact conflicting items; advanced users can inspect the whole build | presenting a giant catalog without a constrained starting point; conflating compatibility with best choice |
| [Can You RUN It](https://www.systemrequirementslab.com/cyri) | outcome-first compatibility question, automatic/manual hardware path, component-level upgrade result | ask the user's actual question; show minimum/recommended gaps per component | surprising users with a detector download; opaque pass/fail based on weak requirements |
| [Steam Deck Verified](https://www.steamdeck.com/en/verified) | top-level status plus inspectable compatibility details and caveats | one understandable outcome; details explain input, display, seamlessness and system support; status can change with versions | hiding the scope/version of a compatibility badge |
| [Postman workspaces](https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview/) | workspace, collections, environments, monitors, overview/activity | one named container gathers a workflow's requests, environment, tests and history; good analogy for advanced workflow owners | making every user create organizational abstractions before their first result |
| [llama-swap](https://github.com/mostlygeek/llama-swap) | playground, running models, load/unload, token metrics, logs | power-user observability and explicit process state | using operational logs/metrics as the main consumer recommendation journey |

## What the comparison says about Local Arcade

No one reference is the product:

- The website finder should feel closer to Can You RUN It plus Steam Deck
  compatibility: ask a concrete question, give an outcome, expose caveats.
- Exact configuration composition should borrow PCPartPicker's live constraint
  behavior.
- The desktop model lifecycle can borrow LM Studio's separation of discover,
  install/load and use.
- Workflow owners need a Postman-like named workspace, but only after they say
  they have a recurring workflow.
- Advanced runner state can borrow llama-swap's observability without putting
  logs and token counters on the default home screen.

# Website screen inventory

The website cannot inspect or execute on the visitor's machine. Every screen
must preserve that boundary.

W0 uses three equal entry cards rather than a question-by-question novice funnel:

1. **Find what fits this computer** — hardware plus broad work, with a manual
   "I do not know" route.
2. **Check what I already use** — manual model/runtime entry on the website or
   an explicit desktop-inspection path.
3. **Compare setups for a job** — common workflow templates plus a composable
   custom description.

"Browse public evidence" is a secondary navigation action, not a fourth primary
journey. No private downstream product is named anywhere in these screens or the
public API.

| ID | Screen | User question | Required output/state |
|---|---|---|---|
| W0 | Entry | “What are you trying to decide?” | choose quick finder, existing setup, recurring workflow or explore evidence |
| W1 | Goal | “What should the model do?” | plain intent plus optional starting template |
| W2 | Workflow review | “Did we understand the job?” | confirmed primitives, assumptions, unknown custom behavior; skipped for simple finder where possible |
| W3 | Hardware | “Which computer are we considering?” | manual exact device/memory or honest partial target; link to desktop detection |
| W4 | Constraints | “What matters or cannot happen?” | patience, offline/privacy, context, tools, license, download/resource limits |
| W5 | Result | “What should I try?” | one primary exact setup, familiar fallback, useful alternative, evidence confidence and withheld claims |
| W6 | Explanation | “Why this and why not the model I expected?” | component evidence, exclusions, popularity/familiarity role, uncertainty and source scope |
| W7 | Configuration | “What exactly would I install/run?” | artifact, runtime, settings, size, source, compatibility and assumptions |
| W8 | What-if | “Would a different device or more memory change this?” | baseline/delta with exact-device versus capacity-only distinction |
| W9 | Coverage gap | “What can Local Arcade not know?” | understood/unknown dimensions and useful next action; never blame hardware for missing data |
| W10 | Desktop handoff | “How do I check this on my machine?” | signed/deep-linkable configuration intent and clear permissions; no automatic execution |
| W11 | Public evidence | “What have matching systems actually shown?” | scoped distributions, sample size, versions and contradictions; not a universal leaderboard |

# Desktop screen inventory

The desktop owns local consent, inventory, execution, private workflows and
verification.

| ID | Screen | User question | Required output/state |
|---|---|---|---|
| D0 | Welcome | “What can this app do, locally?” | three outcomes: understand this PC, optimize what I own, evaluate a workflow |
| D1 | Permission steps | “What will you inspect?” | separate hardware and model-folder consent; path/detail preview; manual alternative |
| D2 | Home | “What is useful now?” | setup status, current recommendation/workflow, one next action; no benchmark laboratory |
| D3 | Computer | “What did you detect and is it right?” | normalized hardware, ambiguity/correction and provenance |
| D4 | Model inventory | “What models/configurations do I already have?” | store/product grouping, hash dedupe, unresolved/corrupt recovery actions |
| D5 | Recommended setup | “What should I use now?” | exact owned/new setup, reasons, familiar anchor and confidence |
| D6 | Setup plan | “What will change on my machine?” | source, bytes, runtime route, settings, permissions, rollback and consent |
| D7 | Verification preview | “Why run this check?” | decision being tested, exact target, tasks, duration/load, local/upload fields |
| D8 | Verification progress | “Is it working and may I stop?” | human phases, safe cancel, thermal/load state; technical log behind disclosure |
| D9 | Verification result | “What did we learn and what changed?” | measured speed/stability/checks, estimate comparison, recommendation delta, limitations |
| D10 | Use/playground handoff | “Can I actually use it?” | open configured model in supported product or minimal local try surface |
| D11 | Workflows | “Which recurring jobs am I evaluating?” | named workflows, current configuration, evidence freshness, gaps and last result |
| D12 | Workflow editor | “What are this job's inputs, outputs, tools and checks?” | primitives, recipe, adapters, private suite and reviewable compiled contract |
| D13 | Workflow comparison | “Which configuration works best here?” | controlled candidates, objective outcomes, preferences, cost/latency and regressions |
| D14 | Private battle | “Which answer/experience do I prefer?” | prompt source, sequential run, blind output, vote then reveal |
| D15 | Experimental evidence | “What harness recipes are being compared?” | advanced/API-oriented harness-response results; not a novice teachability badge |
| D16 | Contribution preview | “Exactly what would leave this PC?” | included/excluded fields, destination, purpose, size, revoke policy and consent |
| D17 | Activity/receipts | “What ran or left the machine?” | executions, authorizations, uploads, failures and receipts |
| D18 | Integrations/API | “How do other tools call Local Arcade?” | endpoints, local token, capabilities, configured inference products and examples |
| D19 | Settings | “What are the defaults and boundaries?” | storage, network, execution, telemetry/contribution and advanced runtime settings |

# API documentation inventory

An API is not a screen flow, but its developer experience must be designed with
the same specificity.

| ID | Documentation/page | Must answer |
|---|---|---|
| API0 | Overview | what Local Arcade decides, what it consumes, and why it is not an inference proxy |
| API1 | Five-minute quickstart | create hardware + simple intent, request recommendation, inspect evidence |
| API2 | Authentication and locality | hosted versus desktop-local endpoint, token, network and data boundary |
| API3 | Workflow compile/create | natural language/templates to reviewable primitives; confirmation and custom extensions |
| API4 | Recommendation/explanation | exact request/response, withheld claims, popularity/familiarity and uncertainty |
| API5 | Hardware simulation/plan | capacity-only versus exact-device semantics and reverse hardware planning |
| API6 | Configuration resolution | broad selector to immutable artifact/runtime/settings or coverage gap |
| API7 | Measurement plan/run | preview, idempotency, authorization, progress/event and receipt contracts |
| API8 | Battle plan/vote | prompt provenance, private/public state, blindness and mutation semantics |
| API9 | Harness experiment | experimental status, fixed baseline, held-out cases, metrics and no-weight boundary |
| API10 | Evidence lookup | provenance, scope, contradictions, confidence and expiry |
| API11 | Portable evidence export | preview a vendor-neutral configuration/evidence bundle, omitted private fields and claim boundaries |
| API12 | Errors and recovery | unavailable versus blocked, stable codes and recoverable actions |
| API13 | Webhooks/events | execution lifecycle without polling; signed events and replay/idempotency |
| API14 | Versioning/migration | schema and methodology versions, deprecation and reproducibility |

# Audience/scenario matrix

Every screen and endpoint must be exercised with at least these journeys:

| Persona | Concrete job | Success condition |
|---|---|---|
| Priya, new user | basic private questions on an office laptop | receives one honest choice or an honest limitation without learning VRAM/GGUF first |
| Marcus, existing app user | choose among installed LM Studio models for document Q&A | inventory resolves; workflow assumptions are reviewable; private test identifies useful setup |
| Ravi, power user | optimize llama.cpp/llama-swap for repository coding | imports exact configuration; uses API; sees component evidence and can distrust/replace priors |
| Elena, operations analyst | extract/check invoices with OCR, schema and calculator | workflow composes from primitives; risk/human review retained; no generic “RAG quality” claim |
| Sam, RAG developer | compare retrieval recipes and models over a private corpus | corpus/retriever/chunking/evaluator identities are pinned; results never pool incorrectly |
| External evaluator or automation tool | carry an exact candidate into a private workflow comparison | receives a vendor-neutral configuration and scoped evidence bundle; the receiving tool must earn workflow-specific conclusions independently |

# Screen-spec template

Every W/D screen receives a separate specification before implementation:

1. audience and entry conditions;
2. one user question the screen answers;
3. required information hierarchy;
4. primary and secondary actions;
5. exact contract input/output;
6. loading, empty, partial, stale, contradictory, offline, blocked and error states;
7. novice-visible language and advanced disclosure;
8. permissions, side effects and data leaving the machine;
9. keyboard/screen-reader/mobile behavior;
10. event/receipt generated;
11. persona walkthrough;
12. reference screenshot/pattern and the reason it was borrowed;
13. acceptance test.

# Required design sequence

1. Capture/link the current official reference images for the six products
   above and annotate interaction patterns.
2. Approve the website information architecture and W0-W11 sequence.
3. Wireframe every website screen and state.
4. Approve the desktop information architecture and D0-D19 sequence.
5. Wireframe every desktop screen and state.
6. Specify API0-API14 endpoint/documentation journeys with complete examples.
7. Run all six personas through the wireframes and API examples.
8. Freeze contracts and screen-state tables.
9. Resume implementation only after the design review records unresolved
   questions and explicit deferrals.
