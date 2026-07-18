import { strategyOptions } from "@/lib/recommendation";
import type { PlatformId, RecommendationQuery, StrategyId, TaskId } from "@/lib/recommendation";

type Props = {
  query: RecommendationQuery;
  onChange(next: RecommendationQuery): void;
};

const platforms: Array<{ id: PlatformId; label: string; memory: string }> = [
  { id: "nvidia", label: "NVIDIA", memory: "VRAM" },
  { id: "apple", label: "Apple Silicon", memory: "unified" },
  { id: "amd", label: "AMD", memory: "VRAM" },
  { id: "cpu", label: "CPU only", memory: "system RAM" },
];

const tasks: Array<{ id: TaskId; label: string }> = [
  { id: "coding", label: "Coding" },
  { id: "general", label: "General" },
  { id: "writing", label: "Writing" },
  { id: "extraction", label: "Structured data" },
];

export function ConfigurationPanel({ query, onChange }: Props) {
  const patch = (change: Partial<RecommendationQuery>) => onChange({ ...query, ...change });
  const patchHardware = (change: Partial<RecommendationQuery["hardware"]>) =>
    patch({ hardware: { ...query.hardware, ...change } });

  return (
    <aside className="config-rail" aria-label="Recommendation configuration">
      <div className="rail-heading">
        <span>CONFIGURATION</span>
        <b>MANUAL · UNVERIFIED</b>
      </div>

      <Control label="Accelerator">
        <select value={query.hardware.platform} onChange={(event) => patchHardware({ platform: event.target.value as PlatformId })}>
          {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
        </select>
      </Control>

      <Control label={`Available ${platforms.find((item) => item.id === query.hardware.platform)?.memory}`}>
        <select value={query.hardware.availableMemoryGb} onChange={(event) => patchHardware({ availableMemoryGb: Number(event.target.value) })}>
          {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map((value) => <option key={value} value={value}>{value} GB</option>)}
        </select>
      </Control>

      <Control label="Primary task">
        <div className="segmented two-column">
          {tasks.map((task) => <Choice key={task.id} active={query.task === task.id} onClick={() => patch({ task: task.id })}>{task.label}</Choice>)}
        </div>
      </Control>

      <Control label="Desired context">
        <div className="segmented">
          {[8, 16, 32, 64].map((value) => <Choice key={value} active={query.desiredContextK === value} onClick={() => patch({ desiredContextK: value })}>{value}K</Choice>)}
        </div>
      </Control>

      <Control label="Sort by">
        <div className="strategy-list">
          {strategyOptions.map((strategy) => (
            <button key={strategy.id} type="button" className={query.strategy === strategy.id ? "active" : ""} onClick={() => patch({ strategy: strategy.id as StrategyId })}>
              <span>{strategy.label}</span><small>{strategy.description}</small>
            </button>
          ))}
        </div>
      </Control>
    </aside>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="control"><label>{label}</label>{children}</section>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{children}</button>;
}

