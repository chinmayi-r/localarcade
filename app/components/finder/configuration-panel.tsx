import { strategyOptions } from "@/lib/recommendation";
import { accelerators, deriveMemory } from "@/lib/accelerators";
import type { PlatformId, RecommendationQuery, StrategyId, TaskId } from "@/lib/recommendation";

type Props = {
  query: RecommendationQuery;
  onChange(next: RecommendationQuery): void;
  onSubmit(): void;
  hasResults: boolean;
};

const platforms: Array<{ id: PlatformId; label: string; memory: string }> = [
  { id: "nvidia", label: "NVIDIA GPU", memory: "VRAM" },
  { id: "apple", label: "Apple Silicon", memory: "unified memory" },
  { id: "amd", label: "AMD GPU", memory: "VRAM" },
  { id: "cpu", label: "CPU only", memory: "system RAM" },
];

const tasks: Array<{ id: TaskId; label: string }> = [
  { id: "coding", label: "Coding" },
  { id: "general", label: "General chat" },
  { id: "writing", label: "Writing" },
  { id: "extraction", label: "Structured data" },
];

const recommendedContextByTask: Record<TaskId, number> = {
  coding: 32,
  general: 16,
  writing: 32,
  extraction: 32,
};

export function ConfigurationPanel({ query, onChange, onSubmit, hasResults }: Props) {
  const patch = (change: Partial<RecommendationQuery>) => onChange({ ...query, ...change });
  const patchHardware = (change: Partial<RecommendationQuery["hardware"]>) => patch({ hardware: { ...query.hardware, ...change } });
  const currentPlatform = platforms.find((item) => item.id === query.hardware.platform);
  const matchingAccelerators = accelerators.filter((item) =>
    (query.hardware.platform === "nvidia" && item.vendor === "nvidia")
    || (query.hardware.platform === "apple" && item.vendor === "apple"),
  );
  const selectedAccelerator = query.hardware.acceleratorId
    ? matchingAccelerators.find((item) => item.id === query.hardware.acceleratorId)
    : undefined;
  const memoryOptions = selectedAccelerator
    ? selectedAccelerator.memoryVariants.map((variant) => variant.memoryGb)
    : [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];

  return (
    <form className="finder-form" id="finder" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="finder-form-heading"><div><span>YOUR COMPUTER</span><h2>Describe the machine</h2></div><small>Manual input · unverified</small></div>
      <div className="finder-fields">
        <Field label="Compute hardware">
          <select value={query.hardware.platform} onChange={(event) => patchHardware({ platform: event.target.value as PlatformId, acceleratorId: undefined, acceleratorFamily: undefined })}>
            {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
          </select>
        </Field>
        {matchingAccelerators.length > 0 && <Field label="Exact device (recommended)">
          <select value={query.hardware.acceleratorId ?? ""} onChange={(event) => {
            const accelerator = matchingAccelerators.find((item) => item.id === event.target.value);
            if (!accelerator) {
              patchHardware({ acceleratorId: undefined, acceleratorFamily: undefined });
              return;
            }
            const memory = deriveMemory(accelerator.id, accelerators);
            const variants = memory.kind === "single-variant" ? [memory.memoryGb] : memory.kind === "multiple-variants" ? memory.variants.map((variant) => variant.memoryGb) : [];
            patchHardware({
              acceleratorId: accelerator.id,
              acceleratorFamily: accelerator.family,
              ...(variants.length && !variants.includes(query.hardware.availableMemoryGb) ? { availableMemoryGb: variants[0] } : {}),
            });
          }}>
            <option value="">Other / enter memory manually</option>
            {matchingAccelerators.map((accelerator) => <option key={accelerator.id} value={accelerator.id}>{accelerator.marketingName}</option>)}
          </select>
        </Field>}
        <Field label={`Available ${currentPlatform?.memory}`}>
          <select value={query.hardware.availableMemoryGb} onChange={(event) => patchHardware({ availableMemoryGb: Number(event.target.value) })}>
            {memoryOptions.map((value) => <option key={value} value={value}>{value} GB</option>)}
          </select>
        </Field>
        {query.hardware.platform !== "cpu" && <Field label="Available system RAM">
          <select value={query.hardware.systemMemoryGb ?? 16} onChange={(event) => patchHardware({ systemMemoryGb: Number(event.target.value) })}>
            {[8, 16, 24, 32, 48, 64, 96, 128].map((value) => <option key={value} value={value}>{value} GB</option>)}
          </select>
        </Field>}
        <Field label="What will you use it for?">
          <select value={query.task} onChange={(event) => {
            const task = event.target.value as TaskId;
            patch({ task, desiredContextK: recommendedContextByTask[task] });
          }}>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}
          </select>
        </Field>
        <Field label="What matters most?">
          <select value={query.strategy} onChange={(event) => patch({ strategy: event.target.value as StrategyId })}>
            {strategyOptions.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.label}</option>)}
          </select>
        </Field>
      </div>
      <details className="advanced-options">
        <summary>Advanced settings <span>Context target: {query.desiredContextK}K</span></summary>
        <div>
          <Field label="Override context target">
            <select value={query.desiredContextK} onChange={(event) => patch({ desiredContextK: Number(event.target.value) })}>
              {[8, 16, 32, 64].map((value) => <option key={value} value={value}>{value}K tokens</option>)}
            </select>
          </Field>
          <p>A practical starting context is selected from the main use. Increase it only for regularly working with long codebases or documents; larger contexts consume more memory.</p>
        </div>
      </details>
      <div className="finder-action"><p>Memory headroom is reserved. Configurations unlikely to load are omitted.</p><button type="submit">{hasResults ? "Update results" : "Get recommendations"}<span>→</span></button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="finder-field"><span>{label}</span>{children}</label>;
}
