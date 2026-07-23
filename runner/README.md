# Local Arcade desktop runner

The runner is Local Arcade's consented local capability boundary. It is a Tauri
2 application with a TypeScript presentation layer and Rust commands.

Implemented today:

- on-request, read-only hardware detection;
- on-request, read-only Ollama/LM Studio/GGUF inventory discovery;
- user-selected `llama-bench` execution with watchdog, preflight and
  repeatability classification;
- user-selected `llama-cli` execution of three fixed mechanical checks;
- local-only results and core IPC-only Tauri permissions.

Not implemented: model downloads, uploads, telemetry, listening sockets,
self-update, public contribution, private Arena UI or automatic background
work.

Run all runner gates:

```powershell
npm.cmd run check
```

Read [the threat model](../docs/runner-threat-model.md), [the audited milestone
ledger](../docs/MILESTONE-STATUS.md), and [the module architecture](../docs/modular-architecture-v2.md)
before expanding capabilities.
