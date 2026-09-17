# Performance baseline

The checked-in test is `infra/load-tests/priority-queue.js`. It exercises the
authenticated priority queue and case-listing endpoints concurrently.

Run it against a seeded local API with:

```powershell
$court = (docker compose -f infra/docker-compose.yml exec -T postgres psql -U justiq -d justiq -t -c 'select id from "Court" order by name limit 1').Trim()
docker run --rm --network host -e BASE_URL=http://host.docker.internal:3000 -e COURT_ID=$court -v "${PWD}/infra/load-tests:/scripts" grafana/k6 run /scripts/priority-queue.js
```

## Baseline

Environment: local Docker Desktop, PostgreSQL/Redis containers, Nest API on the
host, 5 VUs for 30 seconds, seeded demo dataset.

| Metric | Result |
| --- | --- |
| Requests/sec | 39.99 |
| p95 latency | 31.54ms |
| Error rate | 0.00% |

This run completed 1,225 checks with 5 VUs for 30 seconds. It is a local
baseline, not a production capacity claim; repeat it after changing hardware,
database size, or deployment topology.

The script is intentionally repeatable rather than committing machine-specific
numbers. Record the terminal summary in a release note when comparing hardware,
database size, or deployment topology.