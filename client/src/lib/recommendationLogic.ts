/**
 * Pure decision helpers shared by the recommender UI and future API layer.
 * Keeping these rules side-effect free makes them easy to unit test and audit.
 */

export type WorkforcePolicy = {
  maxShiftHours: number;
  maxRouteUtilization: number;
  minimumRestMinutes: number;
};

export function calculateCoverageDays(quantityOnHand: number, forecastDailyDemand: number): number {
  return quantityOnHand / Math.max(forecastDailyDemand, 1);
}

export function isSurplusAfterTransfer(
  quantityOnHand: number,
  transferQuantity: number,
  forecastDailyDemand: number,
  minimumResidualCoverDays: number,
): boolean {
  const residual = quantityOnHand - transferQuantity;
  return residual >= Math.max(forecastDailyDemand, 1) * minimumResidualCoverDays;
}

export function isWorkforceAssignmentSafe(
  routeMinutes: number,
  shiftMinutesAlreadyAssigned: number,
  restMinutesSinceLastRoute: number,
  policy: WorkforcePolicy,
): boolean {
  const shiftCapMinutes = policy.maxShiftHours * 60;
  const routeUtilization = (shiftMinutesAlreadyAssigned + routeMinutes) / shiftCapMinutes;
  return (
    shiftMinutesAlreadyAssigned + routeMinutes <= shiftCapMinutes &&
    routeUtilization <= policy.maxRouteUtilization &&
    restMinutesSinceLastRoute >= policy.minimumRestMinutes
  );
}

export function requiresHumanApproval(
  urgency: "Critical" | "Watch" | "Routine",
  quantity: number,
  criticalQuantityThreshold = 100,
): boolean {
  return urgency === "Critical" || quantity >= criticalQuantityThreshold;
}

export function rankRecommendation(input: {
  urgency: "Critical" | "Watch" | "Routine";
  confidence: number;
  avoidedPurchaseCost: number;
  transferCost: number;
  arrivalWithinSla: boolean;
}): number {
  const urgencyWeight = { Critical: 45, Watch: 28, Routine: 12 }[input.urgency];
  const savingsWeight = Math.min(25, Math.max(0, input.avoidedPurchaseCost - input.transferCost) / 100);
  const slaWeight = input.arrivalWithinSla ? 15 : 0;
  return Math.round(Math.min(100, urgencyWeight + savingsWeight + slaWeight + input.confidence * 0.15));
}
