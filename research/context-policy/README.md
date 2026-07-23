# U30 task-context policy proof

This isolated proof exercises every v1 novice mapping, the example “coding
across a few project files,” explicit expert override, unsupported future
values, malformed and extra fields, immutability, hostile-object handling, and
the package import boundary.

Run:

```powershell
npm.cmd exec -- tsc -p research/context-policy/tsconfig.json
npm.cmd exec -- tsx --test research/context-policy/context-policy.test.ts
node --test research/context-policy/boundary.test.mjs
```

Suggested package script (not added by this lane):

```json
"proof:context-policy": "tsc -p research/context-policy/tsconfig.json && tsx --test research/context-policy/context-policy.test.ts && node --test research/context-policy/boundary.test.mjs"
```
