# NexForge CRM
- Work only within this repository. Do not modify the NexForge ERP.
- Independent application, authentication, database and deployment.
- TypeScript, React/Vite, Express and MongoDB.
- Business data must be scoped to a verified tenant and authorized company.
- Never accept tenant headers as proof of identity or authorization.
- Keep business endpoints closed until authentication is implemented.
- Do not cache authenticated HTTP responses in the service worker.
- Never commit secrets, customer records, location records or local database dumps.
- Keep docs and tools/graph/manifest.json consistent with changes.
- Run npm run check and npm run test:e2e when dependencies are available.
- Report unexecuted checks honestly. Graph metadata is not Graphify AST output.
- All create/edit forms must use accessible modals; lists and search remain in-page.
- Admin-created users receive temporary passwords. Enforce password change and versioned privacy acceptance in the backend before business access.
- Recovery tokens must be hashed, expiring and single-use; never return tokens or credentials in API responses or logs. Send email through configured backend SMTP only.
- Leads, customers and contacts must enforce tenant/company and owner/team scope on every query; use optimistic versions and audit mutations.
- Orders and price tables in commercial-roadmap contracts are planned scope, not operational features.

- Lead intake stays minimal. Require complete persisted/merged qualification data in the backend before qualified stage or conversion. Never clear fiscal fields merely because they are hidden in the initial form.

- Opportunities and their activities inherit the current Party portfolio. Do not introduce stale copied owner scope or accept ownerId from input. Authorize the live parent in lists, details, writes and history.
- Money is integer BRL cents. Won/lost opportunities are terminal in this increment; loss requires a reason. Generate closure/completion timestamps on the server. Serialize new activities with opportunity closure.

- Agenda must query existing OpportunityActivity records without copying them. Direct activities and opportunity activities both inherit the live Party portfolio before counts/pagination.
- Recurrences preserve IANA wall time, use bounded atomic materialization and optimistic versions. Series cancellation affects only future pending occurrences; preserve completed/past records. Never trust frontend timestamps for completion/cancellation.

- Party.ownerId remains authoritative. Assigning a portfolio must atomically synchronize ownerId and contacts; block direct owner changes while Party has portfolioId. Validate active seller membership and live team scope.
- Visit plan drafts must validate portfolio membership, period, duration and overlap. Publish atomically into AgendaActivity with unique plan-item references. Filter plan items by the live Party before counts; never let a previous seller cancel a transferred client's calendar.
- Published plan schedules/status come from AgendaActivity. Restrict rescheduling to the plan period and preserve past/completed activities when cancelling. Planning completion is not proof of a physical visit.
