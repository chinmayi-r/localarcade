# Local Arcade product and interface contract

These instructions apply to the entire repository.

## Required orientation

Read `docs/README.md` first. It defines document authority and prevents older
milestone or screen inventories from overriding the current product direction.
Then read `docs/PRODUCT-BRIEF.md`, `docs/strategy-and-product-rationale.md`,
`docs/MILESTONE-STATUS.md`, and the documents required for the module or
surface being changed. For interface work, also read
`docs/prototypes/README.md` before consulting any recovered prototype.

The current architecture target is M-A through M-P in
`docs/modular-architecture-v2.md`. It is a design target, not proof that current
code already conforms. Consult the approved 2026-07-22 Wave 0 audit reports
listed in `docs/README.md` before reusing or replacing existing code. The
product owner approved the actual content of `docs/PRODUCT-BRIEF.md`,
`docs/screen-contract.md`, and `docs/design-foundation.md` on 2026-07-22. The
resolved first-slice contracts in `docs/contracts/README.md` are also approved.
The dependency direction/order in `docs/worktree-execution-plan.md` is approved;
each implementation checkpoint still requires its own explicit scope contract.

## Two related products

- **Website:** a useful, no-install model and configuration finder. Follow the familiar hardware-advisor pattern: normal website header, short explanation, one contained hardware form, one primary action, results below, and methodology later. Do not use persistent side rails, app chrome, or a leaderboard table on arrival. Do not put a marketing hero in front of the utility.
- **Desktop app / runner:** a separate application and permission boundary in
  this repository. Detection, read-only inventory and existing-engine
  measurements exist; downloads, contributions and public release remain
  separately gated. Never imply that the website has detected hardware or run
  a benchmark when it has not.

## Visual direction

- Use the Forest palette documented in `design-system/colors.css`.
- Preserve the sprawling **configuration field** motif: distributed nodes, faint links, measurement ticks, and occasional colored signals. It is decorative and must never imply measured data.
- Keep the motif low-contrast and spatial. Do not turn it into a planet, central orb, Jupiter-like illustration, or conventional hero artwork.
- Interfaces should feel like an open-source tool: compact, legible, information-dense, and immediately usable.
- Avoid oversized product-marketing typography, full-screen heroes, excessive empty space, rounded SaaS cards, and ornamental layout changes.
- Do not copy layouts, typography choices, or components from `Making Codex styles available to Claude/codex-package/`. That package is source material for the approved palette and motif only.

## Product honesty

- Clearly distinguish estimates, community evidence, and measurements from the current machine.
- A recommendation is a complete configuration: model revision/artifact, quantization, runtime build, backend, context, KV cache, GPU layers, and relevant batch settings when evidence exists.
- Do not claim one configuration is certainly better than another outside the hardware, task, metric, and settings scope supported by evidence.
- Recommend a context target from the novice user's task. Keep raw token counts in optional advanced settings because context changes memory and speed but most newcomers cannot choose it meaningfully.
- When an exact accelerator registry exists, selecting a GPU or Apple chip should derive its memory variants. Until then, explicitly request manually confirmed VRAM or unified memory rather than pretending a platform label identifies the device.
- Preserve fail-closed behavior: showing no safe match is better than padding a ranking with configurations unlikely to run.
- Do not present prototype catalog values as a published leaderboard.

## Implementation

- Prefer small, readable modules and explicit data boundaries so ranking, evidence, runtime, and UI processes can be replaced independently.
- Preserve the existing architecture unless a change has a concrete product or maintenance benefit.
- Keep accessibility, responsive behavior, tests, and the private Sites deployment working.

## Milestone execution and checkpoints

- `docs/worktree-execution-plan.md` is the next-slice execution contract and
  `docs/MILESTONE-STATUS.md` is the current audited implementation state.
  `docs/agent-plan.md` is the historical M-1–M9/R1–R4 contract. Read the current
  plan, status ledger, and every checkpoint-specific contract before changing
  code.
- Execute milestones in dependency order. Adjacent milestones may share one work session only when the checkpoint names each milestone separately, earlier acceptance gates remain satisfied, and no later milestone consumes unfinished earlier work.
- Before starting or advancing milestone work, post a user-visible checkpoint in this exact shape:
  - `Checkpoint — Completing M<N>` or `Checkpoint — Completing M<N> + M<N+1>`
  - current audited status;
  - exact deliverables under each milestone;
  - explicit exclusions/forbidden work;
  - acceptance commands and completion evidence;
  - stop conditions or hard-to-reverse decisions requiring user input.
- A checkpoint is a scope contract, not a progress slogan. Do not add work that is absent from it. If new required work is discovered, amend the checkpoint visibly before continuing.
- Close every checkpoint with: completed deliverables, gate results, remaining work, milestone status changes, commits, and the exact next checkpoint.
- Never call a milestone complete because some of its code exists. Audit every acceptance and forbidden clause mechanically, record the evidence in `docs/MILESTONE-STATUS.md`, and run the full gate suite first.
- If the written order or milestone definition conflicts with dependencies or the product owner's latest direction, stop implementation, explain the conflict, update the plan and decision log, then issue a corrected checkpoint before resuming.
