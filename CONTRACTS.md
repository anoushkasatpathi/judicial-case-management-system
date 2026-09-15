# JCMS Integration Contracts

These contracts are shared by `apps/api` and `apps/web`. The deterministic priority engine remains authoritative: an AI classifier produces a bounded suggestion and never writes the final priority score directly.

## 1. Shared TypeScript Types Package

`packages/shared-types/src/index.ts` exports `UserRole`, `CaseStatus`, `AIPrioritySuggestion`, `QueueUpdatedEvent`, `HearingScheduledEvent`, `EmergencyAlertEvent`, and `DocumentSummary`. Both applications import cross-cutting types from `@justiq/shared-types` rather than duplicating them.

## 2. Priority Score Interface

```ts
interface AIPrioritySuggestion {
	urgency_class: "high" | "medium" | "low";
	rationale: string;
	flagged_factors: string[];       // e.g. ["irreparable harm", "custodial detention"]
	suggested_weight_delta: number;  // bounded, e.g. -15 to +15
}
```

The AI suggestion is an input to the deterministic weighted-scoring engine. It must be bounded and explainable; it must never set the final score directly.

## 3. Auth Guard and `@Roles()` Shape

NestJS routes requiring authentication use `JwtAuthGuard` and routes requiring authorization add `RolesGuard` plus the decorator:

```ts
@Roles(UserRole.Judge, UserRole.Registrar)
@UseGuards(JwtAuthGuard, RolesGuard)
```

The supported roles are `Judge | Advocate | Registrar | Admin | Public`. `JwtAuthGuard` validates the bearer access token and attaches `{ sub, email, role, type }` to `request.user`. `RolesGuard` reads the roles metadata and rejects an authenticated user whose `role` is not listed.

## 4. WebSocket Event Payloads

Socket.IO rooms are scoped per court as `court:{id}`. The API emits these payloads:

```ts
interface QueueUpdatedEvent {
	courtId: string;
	caseIds: string[];
	updatedAt: string;
}

interface HearingScheduledEvent {
	hearingId: string;
	caseId: string;
	courtroomId: string;
	judgeId: string;
	scheduledAt: string;
}

interface EmergencyAlertEvent {
	caseId: string;
	caseNumber: string;
	courtId: string;
	reason: string;
	alertedAt: string;
}
```

Event names are `queue:updated`, `hearing:scheduled`, and `emergency:alert`.

## 5. Case-Document Linking

```ts
interface DocumentSummary {
	documentId: string;
	caseId: string;
	docType: "Petition" | "Evidence" | "Order" | "Affidavit";
	title: string;
	version: number;
	storageUrl: string;
	uploadedAt: string;
}
```

`DocumentSummary` is the compact representation used when a case view links to its documents; document content remains in object storage and is not embedded in the case response.
