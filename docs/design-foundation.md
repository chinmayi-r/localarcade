# Local Arcade shared design foundation

Status: **Product-owner-approved first-slice design authority**, 2026-07-22. It does not by itself authorize production UI implementation.

## Principles

1. Utility first: the main task is visible and usable immediately.
2. Honest density: show enough configuration identity to support a decision without forcing novice users through raw internals.
3. Evidence is semantic: color may reinforce a typed label but never replace text, provenance, or state.
4. Permission clarity: an action names its side effect before it occurs.
5. Spatial, not theatrical: the configuration-field motif supports atmosphere and orientation; it is not a hero illustration or data visualization.

## Canonical color tokens

`design-system/colors.css` is the source of truth.

| Token | Value | Semantic role |
|---|---:|---|
| `--la-void` | `#10120c` | page/window canvas |
| `--la-surface` | `#171a11` | primary form and result surface |
| `--la-raised` | `#20241a` | selected/expanded/overlay surface |
| `--la-line` | `#303523` | default border/divider |
| `--la-line-strong` | `#4b5236` | active grouping and strong boundary |
| `--la-text` | `#e9e7d3` | primary text |
| `--la-muted` | `#8f9377` | secondary text that still must meet contrast requirements at its rendered size |
| `--la-faint` | `#5d6247` | decorative motif and disabled ornament; not essential text |
| `--la-forest` | `#6f9b52` | focus reinforcement, successful available state, positive signal |
| `--la-forest-soft` | `rgba(111,155,82,.12)` | selected/positive tint |
| `--la-tobacco` | `#c1894e` | primary finder/action emphasis, preserving the recorded product decision |
| `--la-sage` | `#9fb56a` | confirmed compatibility or stable local state |
| `--la-rust` | `#c06a3a` | caution, destructive risk, blocked/error emphasis |
| `--la-lavender` | `#b3a4e6` | informational signal, partial evidence, conditioned result or expert annotation |

State labels always include an icon or word. Red/rust does not stand alone. Links remain recognizable through underline or another non-color cue.

## Typography

- Interface sans: a system UI stack (`Inter` only if locally packaged and licensed; otherwise `ui-sans-serif`, `system-ui`, `Segoe UI`, sans-serif).
- Technical values: `ui-monospace`, `SFMono-Regular`, `Cascadia Code`, `Consolas`, monospace.
- Base size: 15–16 px website, 14–15 px dense desktop; minimum 12 px only for nonessential metadata with adequate contrast.
- Scale: 12/14 metadata, 15/16 body, 18/20 section title, 24/28 page title. No oversized marketing display type.
- Line length: approximately 55–75 characters for explanatory prose; tables and configuration blocks may be wider.
- Numerals for metrics use tabular figures when supported.

## Spacing, shape, and density

- Base spacing unit: 4 px. Preferred steps: 4, 8, 12, 16, 24, 32, 48.
- Default control height: 36–40 px; compact expert controls may be 32 px. Touch targets remain at least 44×44 px where touch use is expected.
- Form groups use 12–16 px internal gaps and 24 px section separation.
- Borders are 1 px `--la-line`; selected or focused containers may use `--la-line-strong`.
- Corner radius is restrained: 4–8 px controls, up to 10 px contained panels. Avoid pill-shaped containers and rounded SaaS card grids.
- Shadows are rare and shallow; hierarchy should come from border, surface, and spacing first.
- Results favor compact rows/cards with expandable exact detail, not oversized isolated tiles.

## Focus, keyboard, and errors

- Every interactive control has a visible `:focus-visible` treatment: minimum 2 px `--la-forest` outline with 2 px offset against both canvas and raised surfaces.
- Focus order follows reading order. Expansion, dialogs, and error summaries move or retain focus predictably.
- Validation errors appear beside the field and in a linked summary when submission fails.
- Disabled controls explain why; unavailable actions are not silently hidden when their absence would confuse the task.
- Loading does not remove labels or cause large layout shifts. Progress text is exposed to assistive technology without excessive announcements.

## Configuration-field motif

Reuse the implementation concept in `public/design-system/constellation.js`: distributed nodes, faint links, measurement ticks, and occasional colored signals across open space.

- Decorative only and `aria-hidden`.
- Low contrast; never behind dense body text at a level that harms readability.
- No central orb, planet, Jupiter-like object, conventional hero illustration, radial “AI brain,” or implication of measured topology.
- Node position/color never encodes fit, rank, hardware, benchmark, popularity, or live system state.
- At reduced motion, freeze or remove drifting/pulsing movement while retaining a static field if useful.

## Motion

- Functional transitions: 120–180 ms; larger panel transitions: at most 240 ms.
- Use opacity and small positional changes, not parallax or sweeping stage transitions.
- Progress animation must not imply work before a request begins.
- Respect `prefers-reduced-motion`; remove continuous animation and use immediate state changes where possible.
- CLI equivalents use stable line updates or discrete status events, never decorative spinners in machine-readable mode.

## Surface application

| Surface | Foundation application |
|---|---|
| Website | Conventional header; contained form; results directly below; methodology later; configuration field remains peripheral/background. |
| Desktop | Compact local-tool window; permission previews adjacent to actions; clear local-only state; no website marketing shell. |
| CLI | Same vocabulary, reason codes, and hierarchy through headings, tables, and JSON envelopes; ANSI color optional and never required for meaning. |

## Explicit non-sources

The material under `Making Codex styles available to Claude/codex-package/` may inform the already-approved palette/motif provenance only. Do not copy Claude branding, typography, layouts, navigation, components, interaction patterns, or asset treatment. The recovered prototypes are flow references only and do not override this foundation.
