import type { Provenance } from "../contracts";

export type RunnerPermissionActionId =
  | "inspect-import"
  | "detect-hardware"
  | "scan-model-stores"
  | "hash-selected-artifact"
  | "probe-existing-tool"
  | "prepare-verification";

export type RunnerPermissionActionPreviewV1 = {
  actionId: RunnerPermissionActionId;
  state: "not-requested";
  boundary: "none" | "read-local-system" | "read-local-files" | "execute-selected-tool";
  reads: string[];
  writes: string[];
  executesLocalProcess: boolean;
  loadsModel: boolean;
  network: false;
  upload: false;
  requiresSeparateExplicitAction: true;
};

export type RunnerPermissionPreviewV1 = {
  previewVersion: 1;
  grantsAuthorization: false;
  actions: RunnerPermissionActionPreviewV1[];
  warnings: string[];
};

export type ScanRunnerInventoryInputV1 = {
  action: "scan-model-stores";
  requestId: string;
  extraDirectories: string[];
};

export type ScannedStoreV1 = {
  kind: string;
  path: string;
  exists: boolean;
  truncated: boolean;
};

export type UnreadableEntryV1 = {
  path: string;
  reason: string;
};

export type PromotedArtifactIdentityV1 = {
  artifactId: string;
  repository: string;
  revision: string;
  filename: string;
  sha256: string;
  bytes: number;
  format: string;
  quantization: string;
  license: string;
  status: "promoted";
};

export type InventoryRegistryIdentityV1 = {
  modelFamily: {
    modelFamilyId: string;
    displayName: string;
  };
  artifact: PromotedArtifactIdentityV1;
  provenance: Provenance[];
  registryMetadata: {
    publisher: string;
    baseModel: string;
    model: string;
    maxContextTokens: number;
    chatTemplate: string;
    licenseSourceUrl: string;
    fieldProvenance: Record<string, {
      sourceUrl: string;
      retrievedAt: string;
      kind: string;
    }>;
  };
};

export type InventoryArtifactResolutionV1 =
  | { status: "verified"; identity: InventoryRegistryIdentityV1 }
  | { status: "candidateBySize"; candidates: InventoryRegistryIdentityV1[] }
  | {
    status: "ambiguousIdentity";
    candidates: InventoryRegistryIdentityV1[];
    reasonCode: string;
    message: string;
  }
  | {
    status: "unavailable";
    reasonCode: string;
    message: string;
  };

export type RunnerInventoryArtifactV1 = {
  path: string;
  store: string;
  label: string;
  fileSizeBytes: number;
  sha256: string | null;
  resolution: InventoryArtifactResolutionV1;
};

export type RunnerInventoryDataV1 = {
  registrySnapshotId: string | null;
  registryLastIngestSucceededAt: string | null;
  stores: ScannedStoreV1[];
  artifacts: RunnerInventoryArtifactV1[];
  duplicateGroups: string[][];
  unreadable: UnreadableEntryV1[];
  provenance: string;
};

export type RunnerInventoryPortResultV1 = {
  status: "ok" | "partial" | "unavailable";
  data: RunnerInventoryDataV1;
  warnings: string[];
};

export type RunnerInventoryFailureV1 = {
  status: "blocked" | "error";
  reasonCode: string;
  message: string;
  recoverableActions: string[];
  warnings: string[];
};

export type RunnerInventorySessionV1 = {
  requestId: string;
  result: RunnerInventoryPortResultV1 | RunnerInventoryFailureV1;
};

export type RunnerInventoryPortsV1 = {
  scanModelStores(
    input: Readonly<ScanRunnerInventoryInputV1>,
  ): RunnerInventoryPortResultV1 | Promise<RunnerInventoryPortResultV1>;
};

export type VerifiedInventorySelectionV1 = {
  requestId: string;
  registrySnapshotId: string;
  path: string;
  fileSizeBytes: number;
  sha256: string;
  identity: InventoryRegistryIdentityV1;
};

export type VerifiedInventorySelectionResultV1 =
  | {
    status: "ok";
    data: VerifiedInventorySelectionV1;
    warnings: string[];
  }
  | RunnerInventoryFailureV1;
