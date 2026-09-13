# JustiQ

JustiQ is an AI-powered Judicial Case Management System for case filing, hearing scheduling, courtroom allocation, public case lookup, and human-reviewed legal intelligence.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript, TailwindCSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| Shared contracts | TypeScript package at `packages/shared-types` |
| Data | PostgreSQL with pgvector |
| Infrastructure | Docker Compose, Redis, MinIO |
| AI direction | Structured extraction, RAG summaries, priority suggestions, draft orders |

## Repository layout

- `apps/api`: NestJS backend
- `apps/web`: React + Vite frontend
- `packages/shared-types`: shared TypeScript interfaces
- `infra`: local PostgreSQL, Redis, and MinIO services
- `.github/workflows`: reserved for CI/CD

## Run locally

Prerequisites: Node.js 22+ and Docker Desktop.

```powershell
npm install

docker compose -f infra/docker-compose.yml up -d

npm run dev:api
# In a second terminal:
npm run dev:web
```

The API and web application are intentionally starter shells. Phase 1 will formalize `CONTRACTS.md`, add persistence, authentication, and the first case workflows.
