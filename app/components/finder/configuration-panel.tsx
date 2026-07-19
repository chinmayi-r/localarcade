import { strategyOptions } from "@/lib/recommendation";
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

export function ConfigurationPanel({ query, onChange, onSubmit, hasResults }: Props) {
  const patch = (change: Partial<RecommendationQuery>) => onChange({ ...query, ...change });
  const patchHardware = (change: Partial<RecommendationQuery["hardware"]>) => patch({ hardware: { ...query.hardware, ...change } });
  const currentPlatform = platforms.find((item) => item.id === query.hardware.platform);

  return (
    <form className="finder-form" id="finder" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="finder-form-heading"><div><span>YOUR COMPUTER</span><h2>Tell us what you’re working with</h2></div><small>Manual input · unverified</small></div>
      <div className="finder-fields">
        <Field label="Hardware">
          <select value={query.hardware.platform} onChange={(event) => patchHardware({ platform: event.target.value as PlatformId })}>
            {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
          </select>
        </Field>
        <Field label={`Available ${currentPlatform?.memory}`}>
          <select value={query.hardware.availableMemoryGb} onChange={(event) => patchHardware({ availableMemoryGb: Number(event.target.value) })}>
            {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map((value) => <option key={value} value={value}>{value} GB</option>)}
          </select>
        </Field>
        <Field label="Main use">
          <select value={query.task} onChange={(event) => patch({ task: event.target.value as TaskId })}>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}
          </select>
        </Field>
        <Field label="Context needed">
          <select value={query.desiredContextK} onChange={(event) => patch({ desiredContextK: Number(event.target.value) })}>
            {[8, 16, 32, 64].map((value) => <option key={value} value={value}>{value}K tokens</option>)}
          </select>
        </Field>
        <Field label="What matters most?">
          <select value={query.strategy} onChange={(event) => patch({ strategy: event.target.value as StrategyId })}>
            {strategyOptions.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="finder-action"><p>We reserve memory headroom and omit configurations unlikely to load.</p><button type="submit">{hasResults ? "Update recommendations" : "Find compatible setups"}<span>→</span></button></div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="finder-field"><span>{label}</span>{children}</label>;
}
