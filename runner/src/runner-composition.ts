import { invoke } from "@tauri-apps/api/core";
import { RunnerApplication } from "./runner-application";

/**
 * Composition root: this is the only frontend module that knows Tauri is the
 * concrete M-O transport. UI code receives the application use-case facade.
 */
export function createRunnerApplication(): RunnerApplication {
  return new RunnerApplication(invoke);
}
