import { readFile } from "node:fs/promises";
import { assertRegistryFresh } from "../lib/registry";
import type { RegistrySnapshot } from "../lib/registry";

const path = new URL("../registry/generated/artifacts.json", import.meta.url);
const snapshot = JSON.parse(await readFile(path, "utf8")) as RegistrySnapshot;
const freshness = assertRegistryFresh(snapshot.lastIngestSucceededAt);
console.log(`Registry freshness gate passed (${Math.floor(freshness.ageMs / 3_600_000)} hours old).`);
