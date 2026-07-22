# Community demand sample: what local-model users cannot answer with one lookup

**Status:** directional product research, not a representative survey
**Sample date:** 2026-07-21
**Communities sampled:** public r/LocalLLaMA and r/LocalLLM discussions

## Method

This sample intentionally mixes low-, medium-, and high-engagement questions. Raw votes are
not comparable across community size, post age, or Reddit ranking exposure, so engagement is
only a corroborating signal. A question ranks highly when it is recurrent, affects a meaningful
decision, depends on the user's exact constraints, cannot be settled by static documentation,
and can improve through contributed measurements.

Priority score (0-5 on each term):

`recurrence + decision stakes + personalization + evidence flywheel - existing answerability`

Showcase builds and one-off technical curiosities are excluded from the product priority even
when they attract many votes. Very low-engagement beginner questions are not discarded when the
same question recurs in several forms.

## Directional sample

| Public discussion | Observed question | Engagement signal | Product interpretation |
|---|---|---:|---|
| [Best models by VRAM tier](https://www.reddit.com/r/LocalLLaMA/comments/1k4avlq/whats_the_best_models_available_today_to_run_on/) | Which model is best at 8/16/24/48+ GB under a stated quant and context? | 384 post votes; 302-vote answer | Broad demand, but a static tier table hides task, runtime, license, context, and speed assumptions and goes stale. |
| [16 GB coding model](https://www.reddit.com/r/LocalLLM/comments/1srq4l0/16gb_vram_x_coding_model/) | Which model, quant, context, backend, and flags work in an actual coding harness? | 87 post votes; many incompatible recipes | High-value synthesis: a model that fits can still stop generating or loop on tool calls in the intended harness. |
| [16 GB users' current favorite](https://www.reddit.com/r/LocalLLaMA/comments/1sgvt01/16_gb_vram_users_what_model_do_we_like_best_now/) | Where is the quality/speed/context tradeoff between quantizations and partial offload? | 222 post votes | Exact runtime and cache choices can reverse the practical choice; model name alone is not an answer. |
| [12 GB recommendations](https://www.reddit.com/r/LocalLLaMA/comments/1u8lbxo/best_models_for_a_12gb_vram_card/) | What should a confused newcomer use for chat, roleplay, and coding on one machine? | 16 post votes | Recurrent and legible. The hard part is turning several jobs into honest configurations rather than one universal winner. |
| [Coding on 8 GB with a 1 tok/s tolerance](https://www.reddit.com/r/LocalLLaMA/comments/1p2wnh0/which_model_to_choose_for_coding_with_8gb_vram/) | Is a slower, larger model worth it for a specific language and workflow? | 45 post votes; 42-vote answer | Explicit patience changes the answer. “Fits” is inadequate without an acceptable-experience constraint. |
| [Optimal local setup for one exact GPU](https://www.reddit.com/r/LocalLLM/comments/1tqi09v/whats_the_optimal_local_llm_setup_for_my_hardware/) | Which model, llama.cpp flags, runtime, context, and quant balance this exact machine? | 2 post votes; 10-vote answer | Low raw engagement but directly matches the repeated configuration-composition job. It is not one lookup. |
| [Coding models on 64 GB VRAM](https://www.reddit.com/r/LocalLLaMA/comments/1ujzyf3/devs_you_have_64gb_of_vram_which_model_do_you_use/) | What do comparable owners actually use, at what context and speed? | 122 post votes; 220-vote answer | Revealed use is valuable evidence, but it remains workload- and harness-scoped rather than a universal quality rank. |
| [Complete coding setup and observed speed](https://www.reddit.com/r/LocalLLM/comments/1u9x06x/what_local_coding_llm_hardware_setup_are_you/) | What exact hardware/model/quant/runtime/context combination produces usable coding speed? | 3 post votes | The request asks for the complete configuration Local Arcade already models; community answers are otherwise difficult to compare. |
| [Is local inference worth it?](https://www.reddit.com/r/LocalLLaMA/comments/1kfz7dk/is_local_llm_really_worth_it_or_not/) | Should this person buy a GPU or use APIs after electricity, maintenance, and obsolescence? | 74 post votes | A consequential purchase decision. It needs workload volume, local-only constraints, region/current prices, and frontier-quality requirements. |
| [Which workloads justify expensive local hardware?](https://www.reddit.com/r/LocalLLaMA/comments/1pzj1ul/what_workloads_actually_justify_spending_on_local/) | Where is the local/API crossover, including non-economic constraints? | 2 post votes; substantive discussion | The answer depends on utilization, privacy/offline requirements, depreciation, and work completed—not token price alone. |
| [Coding recommendation for a 5090](https://www.reddit.com/r/LocalLLaMA/comments/1p58cai/recommend_coding_model/) | Can a nominally huge model fit once native precision, quantization, RAM, and context are considered? | 20 post votes | The thread contains conflicting size assumptions. Exact artifact bytes and runtime memory evidence prevent expensive mistakes. |
| [Best model for a 12 GB laptop](https://www.reddit.com/r/LocalLLaMA/comments/1ia78wh/what_is_the_best_local_model_l_for_a_12gb_vram/) | Which model should serve coding, math, and sensitive chat? | 13 post votes | Multiple task-specific winners are more honest than one model recommendation; user testing supplies preference evidence. |

## Prioritized jobs

| Rank | User job | Score | Why Local Arcade can own it |
|---:|---|---:|---|
| 1 | **Given what I own, what complete setup should I use for this job?** | 18 | Requires hardware + artifact + quant + runtime/build + context + harness + acceptable speed. The answer changes as releases and runtimes change. |
| 2 | **What is the best next improvement: a free configuration change, another model, hardware, or an API?** | 17 | Existing advice usually jumps straight to a new GPU or a bigger model. Measured before/after deltas can make the recommendation specific and falsifiable. |
| 3 | **Will it be usable in my actual harness, not merely load or win a benchmark?** | 16 | Tool calling, context behavior, prompt templates, and agent loops belong to the configuration identity. This creates the bridge to a user's own verification. |
| 4 | **Should I buy this hardware for my intended work?** | 15 | High stakes and highly personalized. Requires regional/current prices and a workload-volume model before Local Arcade may ship the claim. |
| 5 | **Which current model should I try in a VRAM tier?** | 10 | Popular, but easy to imitate and partly answerable by a maintained table. It is an entry point, not the product moat. |

## Product consequence

The primary promise is not “verify one configuration.” Verification is the evidence-producing
middle step:

1. **Recommend:** propose the best-supported complete configurations for the user's machine,
   work, harness, and patience.
2. **Verify:** run one exact candidate with the user's existing engine/model to replace estimates
   with observed fit, speed, stability, and mechanical task checks.
3. **Improve:** compare the measured baseline with alternatives and identify the smallest useful
   next move: settings, model, runtime, hardware, or API.

Until comparative evidence exists, the product must say “compatible candidates; not enough
evidence to rank” rather than presenting verification as a recommendation or inventing a winner.

## First-release boundary

Ship the **I already own hardware** route first. It can use exact machine detection, installed
model discovery, complete-configuration evidence, and local verification already present in the
runner. The **I am deciding what to buy** route remains a named next product slice until it has a
current regional price source and a reviewed local-versus-API workload model.
