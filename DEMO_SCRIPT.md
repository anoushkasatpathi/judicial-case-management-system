# JustiQ five-minute demo

All demo users use `JustiQ-Dev-Password-2026`.

1. **Open the system.** Start Docker dependencies, apply migrations, seed the demo data, and open the web app. Mention the three courts, nine cases, lifecycle coverage, emergency matters, audit entries, and seeded AI summaries.
2. **Advocate filing.** Sign in as `advocate@justiq.local`. File a new case with a case number and court UUID. Show the filing confirmation and case tracking view.
3. **Registrar verification.** Sign in as `registrar@justiq.local`. Open the registrar console, review the emergency queue, and use the AI filing extraction control to produce an editable prefill. Emphasize that confirmation is a human action.
4. **Emergency workflow.** Triage and accept `JCMS-2026-0002`, then inject its emergency slot. Explain that every transition is audited and the deterministic priority score remains authoritative.
5. **Live judge view.** Open a second browser session as `judge@justiq.local`. Keep the Judge Dashboard visible while the registrar reorders the queue; point out the WebSocket live connection and updated docket.
6. **AI-assisted review.** From the judge dashboard, request an AI priority hint and click **Summarize file** on a seeded case. Show citations and the explicit human-review label. Generate a draft order from a transcript and explain that only judge approval can write `Hearing.order_summary`.
7. **Public and audit proof.** Open the public portal, search `JCMS-2026-0001`, then show the case audit trail and verification endpoint to demonstrate the tamper-evident hash chain.

Useful seeded accounts:

| Role | Email |
| --- | --- |
| Judge | `judge@justiq.local` |
| Second judge | `judge.sen@justiq.local` |
| Advocate | `advocate@justiq.local` |
| Registrar | `registrar@justiq.local` |
| Admin | `admin@justiq.local` |