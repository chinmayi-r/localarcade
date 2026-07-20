# lib/accelerators

Vendor-sourced accelerator registry: exact devices, their purchasable memory variants, and (when the vendor states one unambiguous figure) memory bandwidth. Data lives in `registry/generated/accelerators.json`; every entry cites its vendor spec page and retrieval time.

Purpose: when the finder user picks a GPU or Apple chip, memory options are **derived from the vendor page** instead of trusted from a platform label. Single-variant devices pre-fill confidently; multi-variant devices (RTX 4060 Ti 8/16 GB, all Apple chips) present the sourced options; unknown devices fail closed to manual entry. Manual confirmation is always retained in the UI per the product contract.

`family` slugs align with `lib/priors` accelerator families so a picked device can reach its throughput evidence; a cross-registry test enforces that shared ids agree on family and kind.

Deliberately small set (8 NVIDIA desktop cards + M5 family). Expansion is by the same rule: official vendor pages only, one entry per device, laptop variants as separate entries (a "RTX 4090 Laptop" has 16 GB, not 24 — never reuse desktop rows for laptop silicon).
