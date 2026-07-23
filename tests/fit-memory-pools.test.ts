import assert from "node:assert/strict";
import test from "node:test";
import { fitMemoryPools, type TwoPoolFitProfile } from "../lib/fit";
import fitProfiles from "../registry/evidence/fit-profiles.json";

const mib = 1024 ** 2;
const profile: TwoPoolFitProfile = {
  id: "measured-partial-offload",
  maxContextTokens: 32_768,
  device: { modelBytes: 4_000 * mib, computeFixedBytes: 300 * mib, contextBytesAtReference: 512 * mib, computeContextBytesAtReference: 0, referenceContextTokens: 4_096 },
  host: { modelBytes: 1_000 * mib, computeFixedBytes: 16 * mib, contextBytesAtReference: 0, computeContextBytesAtReference: 4 * mib, referenceContextTokens: 4_096 },
};

const hardware = { devicePhysicalBytes: 8 * 1024 ** 3, hostPhysicalBytes: 16 * 1024 ** 3, deviceReserveBytes: 256 * mib, hostReserveBytes: 2 * 1024 ** 3, safetyMarginBps: 500 };

test("two-pool fit accounts for VRAM and system RAM independently", () => {
  const result = fitMemoryPools(profile, hardware, 4_096);
  assert.equal(result.fits, true);
  assert.equal(result.device.contextBytes, 512 * mib);
  assert.equal(result.host.computeBytes, 20 * mib);
});

test("failure in either pool fails the complete configuration", () => {
  const deviceFailure = fitMemoryPools(profile, { ...hardware, devicePhysicalBytes: 4 * 1024 ** 3 }, 4_096);
  assert.equal(deviceFailure.fits, false);
  assert.match(deviceFailure.reasons.join(" "), /Device pool/);
  const hostFailure = fitMemoryPools(profile, { ...hardware, hostPhysicalBytes: 2 * 1024 ** 3 }, 4_096);
  assert.equal(hostFailure.fits, false);
  assert.match(hostFailure.reasons.join(" "), /Host pool/);
});

test("both pool requirements grow monotonically with context", () => {
  const small = fitMemoryPools(profile, hardware, 4_096);
  const large = fitMemoryPools(profile, hardware, 8_192);
  assert.ok(large.device.requiredBytes > small.device.requiredBytes);
  assert.ok(large.host.requiredBytes > small.host.requiredBytes);
});

test("checked-in local fit evidence preserves exact artifact, runtime and raw observations", () => {
  const measured = fitProfiles.profiles[0];
  assert.equal(measured.artifactSha256, "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597");
  assert.equal(measured.acceleratorId, "nvidia-geforce-rtx-3060-laptop-gpu");
  assert.equal(measured.runtime.build, "b10061 (5d5306bf3)");
  assert.deepEqual(measured.observationsMiB.map((observation) => observation.contextTokens), [4_096, 16_384]);
  assert.equal(measured.observationsMiB[1].device.context, measured.observationsMiB[0].device.context * 4);
});
