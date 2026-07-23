import type { Provenance } from "../contracts";
import type {
  InventoryArtifactResolutionV1,
  InventoryRegistryIdentityV1,
  RunnerInventoryArtifactV1,
  RunnerInventoryFailureV1,
  RunnerInventoryPortResultV1,
  RunnerInventoryPortsV1,
  RunnerInventorySessionV1,
  RunnerPermissionPreviewV1,
  ScanRunnerInventoryInputV1,
  VerifiedInventorySelectionResultV1,
  VerifiedInventorySelectionV1,
} from "./runner-types";

const inventorySessionBrands = new WeakMap<object, string>();
const verifiedSelectionBrands = new WeakMap<object, string>();

export type {
  InventoryArtifactResolutionV1,
  InventoryRegistryIdentityV1,
  RunnerInventoryArtifactV1,
  RunnerInventoryDataV1,
  RunnerInventoryFailureV1,
  RunnerInventoryPortResultV1,
  RunnerInventoryPortsV1,
  RunnerInventorySessionV1,
  RunnerPermissionActionId,
  RunnerPermissionActionPreviewV1,
  RunnerPermissionPreviewV1,
  ScanRunnerInventoryInputV1,
  VerifiedInventorySelectionResultV1,
  VerifiedInventorySelectionV1,
} from "./runner-types";

/**
 * Describes runner-local boundaries. This value is information only: it is
 * deliberately incapable of authorizing any action.
 */
export function previewRunnerPermissions(): RunnerPermissionPreviewV1 {
  return deepFreeze({
    previewVersion: 1,
    grantsAuthorization: false,
    actions: [
      permission("inspect-import", "none", [], false),
      permission(
        "detect-hardware",
        "read-local-system",
        ["operating-system and hardware inventory"],
        false,
      ),
      permission(
        "scan-model-stores",
        "read-local-files",
        ["selected model-store directories and file metadata"],
        false,
      ),
      permission(
        "hash-selected-artifact",
        "read-local-files",
        ["bytes of the explicitly selected model artifact"],
        false,
      ),
      permission(
        "probe-existing-tool",
        "execute-selected-tool",
        ["bytes and identity output of the explicitly selected executable"],
        true,
      ),
      permission(
        "prepare-verification",
        "read-local-files",
        ["selected artifact and executable bytes for identity checks"],
        false,
      ),
    ],
    warnings: [
      "Previewing permissions does not perform or authorize an action.",
      "Local process isolation and network denial are not established by this preview.",
    ],
  });
}

/**
 * Runs only the explicitly invoked M-I inventory port. M-O freezes the port
 * input and faithfully preserves M-I's ok/partial/unavailable status.
 */
export async function scanRunnerInventory(
  input: ScanRunnerInventoryInputV1,
  ports: RunnerInventoryPortsV1,
): Promise<RunnerInventorySessionV1> {
  try {
    if (!validScanInput(input) || !plainData(ports)
      || typeof ports.scanModelStores !== "function") {
      return sealSession({
        requestId: safeRequestId(input),
        result: failure(
          "blocked",
          "orchestrator.inventory-input-invalid",
          "Inventory requires an explicit scan action, request ID and directory list.",
        ),
      });
    }
    const request = structuredClone(input);
    deepFreeze(request);

    let raw: RunnerInventoryPortResultV1;
    try {
      raw = await ports.scanModelStores(request);
    } catch {
      return sealSession({
        requestId: request.requestId,
        result: failure(
          "error",
          "orchestrator.inventory-port-failed",
          "The read-only inventory provider failed.",
          ["Retry the explicit inventory action."],
        ),
      });
    }
    if (!validInventoryResult(raw)) {
      return sealSession({
        requestId: request.requestId,
        result: failure(
          "error",
          "orchestrator.inventory-port-invalid",
          "The inventory provider returned a hostile or malformed result.",
        ),
      });
    }
    const result = structuredClone(raw);
    deepFreeze(result);
    return sealSession({ requestId: request.requestId, result });
  } catch {
    return sealSession({
      requestId: safeRequestId(input),
      result: failure(
        "error",
        "orchestrator.inventory-input-hostile",
        "Inventory rejected a hostile or unreadable input.",
      ),
    });
  }
}

/**
 * Selects only a full M-I verified identity. Candidate-by-size, ambiguous and
 * unavailable findings remain visible in inventory but cannot cross into M-J.
 */
export function selectVerifiedInventoryArtifact(
  session: RunnerInventorySessionV1,
  path: string,
): VerifiedInventorySelectionResultV1 {
  try {
    if (!plainData(session) || !nonEmpty(path)
      || inventorySessionBrands.get(session) !== stableJson(session)) {
      return failure(
        "blocked",
        "orchestrator.inventory-session-invalid",
        "Inventory selection requires the intact result returned by this M-O process.",
      );
    }
    const result = session.result;
    if (!isInventoryDataResult(result)) {
      return { ...result, recoverableActions: [...result.recoverableActions],
        warnings: [...result.warnings] };
    }
    if (result.status === "unavailable") {
      return failure(
        "blocked",
        "orchestrator.inventory-unavailable",
        "Unavailable inventory cannot supply a verified artifact.",
        ["Run inventory again after resolving its warnings."],
        result.warnings,
      );
    }
    const matches = result.data.artifacts.filter((item) => item.path === path);
    if (matches.length !== 1) {
      return failure(
        "blocked",
        matches.length === 0
          ? "orchestrator.inventory-artifact-not-found"
          : "orchestrator.inventory-artifact-path-ambiguous",
        "Select one exact artifact path from the intact inventory result.",
      );
    }
    const artifact = matches[0];
    if (artifact.resolution.status !== "verified") {
      return failure(
        "blocked",
        "orchestrator.inventory-artifact-not-verified",
        "Only an artifact verified against immutable registry identity may be selected.",
      );
    }
    const identity = artifact.resolution.identity;
    if (result.data.registrySnapshotId === null
      || artifact.sha256 !== identity.artifact.sha256
      || artifact.fileSizeBytes !== identity.artifact.bytes) {
      return failure(
        "blocked",
        "orchestrator.inventory-identity-binding-invalid",
        "The outer inventory finding does not bind to its verified registry identity.",
      );
    }
    const selection: VerifiedInventorySelectionV1 = deepFreeze({
      requestId: session.requestId,
      registrySnapshotId: result.data.registrySnapshotId,
      path: artifact.path,
      fileSizeBytes: artifact.fileSizeBytes,
      sha256: artifact.sha256,
      identity: structuredClone(identity),
    });
    verifiedSelectionBrands.set(selection, stableJson(selection));
    return deepFreeze({ status: "ok", data: selection, warnings: [...result.warnings] });
  } catch {
    return failure(
      "error",
      "orchestrator.inventory-selection-hostile",
      "Inventory selection rejected hostile or malformed data.",
    );
  }
}

export function isIntactVerifiedInventorySelection(
  value: unknown,
): value is VerifiedInventorySelectionV1 {
  try {
    return plainData(value)
      && verifiedSelectionBrands.get(value) === stableJson(value);
  } catch {
    return false;
  }
}

function permission(
  actionId: RunnerPermissionPreviewV1["actions"][number]["actionId"],
  boundary: RunnerPermissionPreviewV1["actions"][number]["boundary"],
  reads: string[],
  executesLocalProcess: boolean,
): RunnerPermissionPreviewV1["actions"][number] {
  return {
    actionId,
    state: "not-requested",
    boundary,
    reads,
    writes: [],
    executesLocalProcess,
    loadsModel: false,
    network: false,
    upload: false,
    requiresSeparateExplicitAction: true,
  };
}

function sealSession(session: RunnerInventorySessionV1): RunnerInventorySessionV1 {
  deepFreeze(session);
  inventorySessionBrands.set(session, stableJson(session));
  return session;
}

function validScanInput(value: unknown): value is ScanRunnerInventoryInputV1 {
  return plainRecord(value, ["action", "requestId", "extraDirectories"])
    && value.action === "scan-model-stores"
    && nonEmpty(value.requestId)
    && stringArray(value.extraDirectories)
    && new Set(value.extraDirectories).size === value.extraDirectories.length;
}

function validInventoryResult(value: unknown): value is RunnerInventoryPortResultV1 {
  if (!plainRecord(value, ["status", "data", "warnings"])
    || !["ok", "partial", "unavailable"].includes(String(value.status))
    || !stringArray(value.warnings)
    || !plainRecord(value.data, [
      "registrySnapshotId",
      "registryLastIngestSucceededAt",
      "stores",
      "artifacts",
      "duplicateGroups",
      "unreadable",
      "provenance",
    ])) return false;
  const data = value.data;
  return nullableString(data.registrySnapshotId)
    && nullableString(data.registryLastIngestSucceededAt)
    && Array.isArray(data.stores)
    && data.stores.every((store) =>
      plainRecord(store, ["kind", "path", "exists", "truncated"])
      && nonEmpty(store.kind) && nonEmpty(store.path)
      && typeof store.exists === "boolean" && typeof store.truncated === "boolean")
    && Array.isArray(data.artifacts)
    && data.artifacts.every(validArtifact)
    && Array.isArray(data.duplicateGroups)
    && data.duplicateGroups.every(stringArray)
    && Array.isArray(data.unreadable)
    && data.unreadable.every((entry) =>
      plainRecord(entry, ["path", "reason"])
      && nonEmpty(entry.path) && nonEmpty(entry.reason))
    && nonEmpty(data.provenance);
}

function isInventoryDataResult(
  value: RunnerInventoryPortResultV1 | RunnerInventoryFailureV1,
): value is RunnerInventoryPortResultV1 {
  return value.status === "ok"
    || value.status === "partial"
    || value.status === "unavailable";
}

function validArtifact(value: unknown): value is RunnerInventoryArtifactV1 {
  return plainRecord(value, [
    "path", "store", "label", "fileSizeBytes", "sha256", "resolution",
  ])
    && nonEmpty(value.path) && nonEmpty(value.store) && nonEmpty(value.label)
    && uint(value.fileSizeBytes)
    && (value.sha256 === null || sha256(value.sha256))
    && validResolution(value.resolution);
}

function validResolution(value: unknown): value is InventoryArtifactResolutionV1 {
  if (!plainData(value) || typeof value.status !== "string") return false;
  if (value.status === "verified") {
    return plainRecord(value, ["status", "identity"]) && validIdentity(value.identity);
  }
  if (value.status === "candidateBySize") {
    return plainRecord(value, ["status", "candidates"])
      && Array.isArray(value.candidates) && value.candidates.every(validIdentity);
  }
  if (value.status === "ambiguousIdentity") {
    return plainRecord(value, ["status", "candidates", "reasonCode", "message"])
      && Array.isArray(value.candidates) && value.candidates.every(validIdentity)
      && nonEmpty(value.reasonCode) && nonEmpty(value.message);
  }
  return value.status === "unavailable"
    && plainRecord(value, ["status", "reasonCode", "message"])
    && nonEmpty(value.reasonCode) && nonEmpty(value.message);
}

function validIdentity(value: unknown): value is InventoryRegistryIdentityV1 {
  if (!plainRecord(value, ["modelFamily", "artifact", "provenance", "registryMetadata"])
    || !plainRecord(value.modelFamily, ["modelFamilyId", "displayName"])
    || !nonEmpty(value.modelFamily.modelFamilyId)
    || !nonEmpty(value.modelFamily.displayName)
    || !plainRecord(value.artifact, [
      "artifactId", "repository", "revision", "filename", "sha256", "bytes",
      "format", "quantization", "license", "status",
    ])
    || ![
      value.artifact.artifactId, value.artifact.repository, value.artifact.revision,
      value.artifact.filename, value.artifact.format, value.artifact.quantization,
      value.artifact.license,
    ].every(nonEmpty)
    || !sha256(value.artifact.sha256) || !uint(value.artifact.bytes)
    || value.artifact.status !== "promoted"
    || !Array.isArray(value.provenance) || !value.provenance.every(validProvenance)
    || !plainRecord(value.registryMetadata, [
      "publisher", "baseModel", "model", "maxContextTokens", "chatTemplate",
      "licenseSourceUrl", "fieldProvenance",
    ])) return false;
  const metadata = value.registryMetadata;
  return [metadata.publisher, metadata.baseModel, metadata.model,
    metadata.chatTemplate, metadata.licenseSourceUrl].every(nonEmpty)
    && uint(metadata.maxContextTokens) && metadata.maxContextTokens > 0
    && plainData(metadata.fieldProvenance)
    && Object.values(metadata.fieldProvenance).every((field) =>
      plainRecord(field, ["sourceUrl", "retrievedAt", "kind"])
      && nonEmpty(field.sourceUrl) && nonEmpty(field.retrievedAt) && nonEmpty(field.kind));
}

function validProvenance(value: unknown): value is Provenance {
  if (!plainRecord(value, [
    "source", "retrievedAt", "observedAt", "method", "hardwareMatch",
    "configurationMatch", "scope", "sampleCount", "measurement", "rawSourceRecordRef",
  ])
    || !plainRecord(value.source, ["id", "version", "revision", "url"])
    || !nonEmpty(value.source.id)
    || ![value.source.version, value.source.revision, value.source.url,
      value.retrievedAt, value.observedAt, value.rawSourceRecordRef].every(nullableString)
    || !["estimate", "measurement", "preference", "objective-check", "self-reported",
      "detected", "imported"].includes(String(value.method))
    || !["exact", "calibrated-neighbor", "coarse-bucket", "not-applicable",
      "unknown"].includes(String(value.hardwareMatch))
    || !["exact", "compatible", "family-proxy", "not-applicable",
      "unknown"].includes(String(value.configurationMatch))
    || !plainRecord(value.scope, ["taskFamily", "taskPackId", "promptId", "harnessId"])
    || !Object.values(value.scope).every(nullableString)
    || !(value.sampleCount === null || uint(value.sampleCount))) return false;
  if (value.measurement === null) return true;
  return plainRecord(value.measurement, [
    "unit", "interval", "confidence", "eligible", "eligibilityReasons",
  ])
    && ["bytes", "tokens-per-second", "milliseconds", "probability", "joules",
      "boolean", "count", "other"].includes(String(value.measurement.unit))
    && (value.measurement.interval === null
      || (plainRecord(value.measurement.interval, ["lower", "upper"])
        && finite(value.measurement.interval.lower)
        && finite(value.measurement.interval.upper)))
    && (value.measurement.confidence === null || finite(value.measurement.confidence))
    && (value.measurement.eligible === null
      || typeof value.measurement.eligible === "boolean")
    && stringArray(value.measurement.eligibilityReasons);
}

function failure(
  status: RunnerInventoryFailureV1["status"],
  reasonCode: string,
  message: string,
  recoverableActions: string[] = [],
  warnings: string[] = [],
): RunnerInventoryFailureV1 {
  return deepFreeze({ status, reasonCode, message, recoverableActions, warnings });
}

function safeRequestId(value: unknown): string {
  try {
    return plainData(value) && nonEmpty(value.requestId) ? value.requestId : "invalid";
  } catch {
    return "invalid";
  }
}

function plainRecord<T extends readonly string[]>(
  value: unknown,
  keys: T,
): value is Record<T[number], unknown> {
  return plainData(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function plainData(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value))
    .every((descriptor) => !("get" in descriptor) && !("set" in descriptor));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || nonEmpty(value);
}

function uint(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
