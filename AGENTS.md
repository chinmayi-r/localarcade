# Local Arena product and interface contract

These instructions apply to the entire repository.

## Two related products

- **Website:** a useful, no-install model and configuration finder. Its first viewport must contain working controls and recommendation results. Do not put a marketing hero in front of the utility.
- **Desktop app / runner:** a separate, future product for hardware detection, downloads, local benchmarks, and contributed measurements. Never imply that the website has detected hardware or run a benchmark when it has not.

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
- Preserve fail-closed behavior: showing no safe match is better than padding a ranking with configurations unlikely to run.
- Do not present prototype catalog values as a published leaderboard.

## Implementation

- Prefer small, readable modules and explicit data boundaries so ranking, evidence, runtime, and UI processes can be replaced independently.
- Preserve the existing architecture unless a change has a concrete product or maintenance benefit.
- Keep accessibility, responsive behavior, tests, and the private Sites deployment working.

