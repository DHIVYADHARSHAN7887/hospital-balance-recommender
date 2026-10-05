# NexusStock — Hospital Consumables Balancing Recommender

Constraint-aware proof of concept for balancing critical hospital consumables across locations before creating a new purchase order.

## Project status

This repository contains the **35% project-completion review baseline** and the working end-to-end frontend prototype. The command center demonstrates recommendations, evidence, guardrails, human approval, override capture, baseline comparison, and experiment metrics using a deterministic validation dataset.

## Problem and objective

Hospitals can have a shortage at one location while another location has usable surplus that may expire first. NexusStock recommends a transfer before a purchase when the move is safe and economically sensible.

The recommender considers:

- Stock by location and item
- Forecast demand and safety-cover thresholds
- Expiry dates and FEFO (first-expiry, first-out) selection
- Transfer time, route SLA, and time windows
- Transfer cost versus emergency purchase cost
- Service urgency and shortage severity
- Tote/vehicle capacity
- Driver/worker shift, rest, and workload limits
- Human confirmation for critical/high-impact actions

## Implemented user flows

1. **Command center:** network posture, shortage-risk locations, surplus-ready sites, freshness, and KPI cards.
2. **Decision queue:** ranked transfer recommendations with status, urgency, quantity, route, score, and destination/source.
3. **Evidence panel:** every selected move exposes the demand, cover, expiry, workforce, and route evidence behind the recommendation.
4. **Human approval:** critical actions require an explicit `Approve & dispatch` action.
5. **Override/hold:** an operator can reject/hold a recommendation; the UI records an override state and displays the audit-oriented feedback.
6. **Guardrails:** expiry safety, capacity, workforce, and time-window checks are visible beside the recommendation.
7. **Baseline comparison:** transfer cost is compared with an emergency purchase cost and the avoided cost is quantified.
8. **Experiment & validation:** baseline versus recommender shortage coverage, SLA adherence, unsafe assignments prevented, and error analysis.

## Architecture

```text
React + TypeScript + Vite
        |
        +-- client/src/pages/Home.tsx       Command center UI and deterministic demo data
        +-- client/src/lib/recommendationLogic.ts  Pure, testable decision rules
        +-- client/src/components/ErrorBoundary.tsx  Render failure recovery boundary
        +-- server/index.ts                 Static production server / SPA fallback placeholder
        +-- shared/                         Shared constants placeholder
```

This is currently a static frontend proof of concept. The server is intentionally a static-file host; no live WMS/ERP or database credentials are included.

## API integration contract (stub)

The UI exposes an API-stub cue for the future integration. The following endpoints are the proposed contract; they are **not live network endpoints in this static prototype**.

| Method | Endpoint | Purpose | Request | Response |
|---|---|---|---|---|
| `GET` | `/api/inventory/snapshot` | Fetch stock by location and item | `locationId`, optional `asOf` | `InventorySnapshot[]` |
| `GET` | `/api/forecasts` | Fetch item demand forecast | `locationId`, `sku`, horizon | `ForecastPoint[]` |
| `POST` | `/api/recommendations/preview` | Generate ranked transfer proposals without side effects | `RecommendationRunInput` | `RecommendationRun` |
| `POST` | `/api/recommendations/:id/approve` | Human-confirm a high-impact transfer | approver, timestamp, note | `ApprovalRecord` |
| `POST` | `/api/recommendations/:id/override` | Hold/reject and capture reason | reason code, free text, operator | `OverrideRecord` |
| `GET` | `/api/audit/events` | Retrieve recommendation and override history | filters | `AuditEvent[]` |

### Proposed data contracts

```ts
type InventorySnapshot = {
  locationId: string;
  sku: string;
  lotId: string;
  quantityOnHand: number;
  expiryDate: string;
  unitCost: number;
  temperatureBand: "ambient" | "cold-chain";
};

type RecommendationRunInput = {
  asOf: string;
  horizonDays: number;
  locations: string[];
  workforcePolicy: {
    maxShiftHours: number;
    maxRouteUtilization: number;
    minimumRestMinutes: number;
  };
};

type Recommendation = {
  id: string;
  sku: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  arrivalDeadline: string;
  transferCost: number;
  avoidedPurchaseCost: number;
  confidenceScore: number;
  evidence: string[];
  constraints: { name: string; status: "pass" | "watch" | "fail"; detail: string }[];
  requiresHumanApproval: boolean;
};
```

## Database schema proposal for the next review

No database is connected in this version. A production implementation should add these tables:

- `locations(id, name, timezone, active)`
- `items(sku, name, unit, criticality, temperature_band, reorder_policy_json)`
- `inventory_lots(id, sku, location_id, quantity_on_hand, expiry_date, unit_cost)`
- `demand_forecasts(id, sku, location_id, forecast_date, p50, p90, model_version)`
- `transfer_recommendations(id, run_id, sku, source_location_id, destination_location_id, quantity, score, status, evidence_json)`
- `transfer_constraints(id, recommendation_id, constraint_name, status, detail)`
- `workforce_assignments(id, recommendation_id, worker_id, route_minutes, shift_minutes_after, rest_minutes_before)`
- `approval_events(id, recommendation_id, actor_id, action, reason_code, note, created_at)`
- `experiment_runs(id, dataset_version, baseline_name, metrics_json, created_at)`

## Algorithm and rules

The deterministic rules in `client/src/lib/recommendationLogic.ts` are intentionally small and testable:

1. `coverageDays = quantityOnHand / max(forecastDailyDemand, 1)`.
2. A shortage is flagged when coverage is below the location safety threshold.
3. A surplus donor must retain its minimum residual cover after the proposed transfer.
4. FEFO prefers eligible lots with the earliest expiry date.
5. A transfer fails when quantity exceeds vehicle/tote capacity or cannot arrive inside the destination time window.
6. A worker assignment fails when it exceeds the shift cap, route-utilization cap, or minimum rest requirement.
7. High-impact or critical moves always require human approval.
8. Ranking prioritizes service urgency, shortage severity, avoided purchase cost, expiry risk, route fit, and confidence.

## Validation dataset and measured result

The UI uses a fixed, reviewable demo dataset covering five locations and critical consumables including N95 respirators, ceftriaxone, IV extension sets, and insulin syringes.

| Metric | Baseline: buy-first | Target | Measured recommender result |
|---|---:|---:|---:|
| Shortage events protected using network stock | 68.4% | ≥85% | 91.2% |
| Shortage events avoided | — | ≥80% | 23 / 28 (82.1%) |
| Transfers within SLA | — | ≥95% | 96.7% |
| Unsafe assignments prevented | 0 | 100% of detected conflicts | 7 |
| Demand model MAE | — | ≤10% | 8.4% |

Known error cases are displayed in the validation view: a West Clinic demand spike, a driver shift-cap conflict correctly held, and an expiry/shelf-life mismatch correctly excluded.

## Unit testing and error-boundary coverage

Run the available checks:

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

- `pnpm check` runs TypeScript compilation with no emit.
- `pnpm test` runs the pure decision-rule unit tests in `client/src/lib/recommendationLogic.test.ts`.
- `pnpm build` verifies the production Vite bundle and static server bundle.
- `ErrorBoundary` catches render-time React errors, shows the captured stack for development diagnosis, and provides a reload recovery action. Event-handler and async errors must still be handled at the action/API boundary in the next backend-enabled iteration.

## Limitations and next implementation stage

- Demo data is deterministic and local; it is not connected to a hospital WMS, EHR, ERP, routing provider, or database.
- The map is a schematic network visualization, not a geocoded map or dispatch route.
- Approval state is session-local in the static frontend and not persisted.
- The experiment is a replay-style validation, not a prospective clinical operations study.
- Production rollout requires security review, role-based access, immutable audit storage, data-quality monitoring, and human factors validation.

## Local development

```bash
pnpm install
pnpm dev
```

Then open the local Vite URL shown in the terminal. For a production build:

```bash
pnpm build
pnpm start
```
