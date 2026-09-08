import { describe, expect, it } from "vitest";
import { DELETION_GRACE_PERIOD_MS, isEligibleForPurge } from "./data";

describe("isEligibleForPurge", () => {
  it("is not eligible before the 14-day grace period elapses", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS + 1000).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(false);
  });

  it("is eligible exactly at the 14-day boundary", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(true);
  });

  it("is eligible well past the grace period", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    const requestedAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(isEligibleForPurge(requestedAt, now)).toBe(true);
  });
});
