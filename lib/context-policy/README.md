# Versioned task-to-context policy

This pure package owns the U30 novice task/scope defaults below M-O. M-P may
present these choices but must not invent token values. Policy v1 maps a closed,
task-specific scope vocabulary to a planning context target:

| Task | Scope choices and targets |
|---|---|
| Coding | snippet 4,096; single file 8,192; few files 16,384; repository 32,768 |
| Writing | short form 4,096; document 8,192; long document 32,768 |
| Extraction | single record 4,096; document 8,192; document set 32,768 |
| General | quick question 4,096; conversation 8,192; reference material 16,384 |

`other` has no novice default in v1. It returns `unavailable`; an expert may
instead provide a positive integer explicitly. Expert overrides are labeled as
overrides and still require downstream artifact, runtime, and hardware fit
checks.

The output supplies `family`, `scopeLabel`, and `derivedContextTokens` for the
M-A recommendation request. A derived context is a planning target only. This
package does not inspect hardware, select a candidate, reduce context to make a
candidate fit, or authorize any side effect.
