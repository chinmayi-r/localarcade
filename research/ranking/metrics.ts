export type LabeledCandidate = { candidateId: string; familyId: string; exactConfigurationComplete: boolean; observedRunnable: boolean | null; claims: Array<{ supported: boolean | null }>; consensusMustConsider: boolean | null };
export type MetricValue = { kind: "value"; value: number; numerator: number; denominator: number } | { kind: "unavailable"; reason: string };

function ratio(values: Array<boolean | null>, unavailableReason: string): MetricValue {
  const known = values.filter((value): value is boolean => value !== null);
  if (known.length === 0) return { kind: "unavailable", reason: unavailableReason };
  const numerator = known.filter(Boolean).length;
  return { kind: "value", value: numerator / known.length, numerator, denominator: known.length };
}

export function evaluateSelection(selectedIds: string[], labels: LabeledCandidate[]) {
  const byId = new Map(labels.map((label) => [label.candidateId, label]));
  const selected = selectedIds.map((id) => byId.get(id)).filter((label): label is LabeledCandidate => Boolean(label));
  const consensus = labels.filter((label) => label.consensusMustConsider === true);
  const selectedConsensus = new Set(selected.filter((label) => label.consensusMustConsider).map((label) => label.candidateId));
  return {
    runnablePrecision: ratio(selected.map((label) => label.observedRunnable), "no selected candidate has a measured run outcome"),
    exactConfigurationCompleteness: ratio(selected.map((label) => label.exactConfigurationComplete), "no selected candidates were labeled"),
    supportedClaimPrecision: ratio(selected.flatMap((label) => label.claims.map((claim) => claim.supported)), "no selected claim has a support label"),
    consensusRecall: consensus.length === 0 ? { kind: "unavailable" as const, reason: "no must-consider consensus labels" } : { kind: "value" as const, value: selectedConsensus.size / consensus.length, numerator: selectedConsensus.size, denominator: consensus.length },
    distinctFamilies: new Set(selected.map((label) => label.familyId)).size,
    selectedCount: selected.length,
    missingLabelIds: selectedIds.filter((id) => !byId.has(id)),
  };
}
