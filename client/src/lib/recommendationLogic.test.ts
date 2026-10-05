import { describe, expect, it } from "vitest";
import {
  calculateCoverageDays,
  isSurplusAfterTransfer,
  isWorkforceAssignmentSafe,
  rankRecommendation,
  requiresHumanApproval,
} from "./recommendationLogic";

describe("recommendation decision rules", () => {
  it("calculates coverage using a safe denominator for zero demand", () => {
    expect(calculateCoverageDays(120, 30)).toBe(4);
    expect(calculateCoverageDays(120, 0)).toBe(120);
  });

  it("only marks a donor as surplus when residual cover remains safe", () => {
    expect(isSurplusAfterTransfer(500, 100, 100, 3)).toBe(true);
    expect(isSurplusAfterTransfer(500, 220, 100, 3)).toBe(false);
  });

  it("blocks unsafe workforce assignments", () => {
    const policy = { maxShiftHours: 4, maxRouteUtilization: 0.85, minimumRestMinutes: 30 };
    expect(isWorkforceAssignmentSafe(30, 120, 45, policy)).toBe(true);
    expect(isWorkforceAssignmentSafe(60, 150, 45, policy)).toBe(false);
    expect(isWorkforceAssignmentSafe(30, 120, 10, policy)).toBe(false);
  });

  it("requires human approval for critical or large moves", () => {
    expect(requiresHumanApproval("Critical", 1)).toBe(true);
    expect(requiresHumanApproval("Routine", 100)).toBe(true);
    expect(requiresHumanApproval("Routine", 99)).toBe(false);
  });

  it("ranks an on-time critical move above a late routine move", () => {
    const critical = rankRecommendation({ urgency: "Critical", confidence: 98, avoidedPurchaseCost: 1470, transferCost: 18, arrivalWithinSla: true });
    const routine = rankRecommendation({ urgency: "Routine", confidence: 98, avoidedPurchaseCost: 200, transferCost: 40, arrivalWithinSla: false });
    expect(critical).toBeGreaterThan(routine);
    expect(critical).toBeLessThanOrEqual(100);
  });
});
