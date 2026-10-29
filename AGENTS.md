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

- Field visits require verified visit and activity permissions, current Party ownership, bounded location input and explicit per-operation authorization. Device coordinates are untrusted, never proof of presence.
- Preserve field execution: ordinary agenda edits cannot rewrite it; plan/series cancellation and Party archive cannot orphan an active visit. Transactions serialize through Party, AgendaActivity and VisitPlan. A partial unique executor index prevents simultaneous open visits across companies. Interrupted execution is distinct from geolocated checkout.

- Revised target rules are specified in docs/commercial-rules-review.md. Preserve reviewed qualification (sales submission, sales-admin approval/revision and atomic conversion), credit/payment authorization and a deliberate legacy-customer policy. These workflow controls are now implemented; see docs/lead-qualification.md. Direct conversion/customer creation must remain closed. Existing customers require explicit reviewed regularization, never silent approval.
- Future catalog includes atomic automatic codes, manufacturer SKU, decimal units, homogeneous/mixed boxes and variable weight. Future global goals belong to sales administration; regional/team allocation belongs to explicitly authorized supervisors. Never infer regional authority from a frontend regionId.
- Offline must not bypass single-session, current membership/portfolio, approval or credit rules; queued operations remain pending until reauthorized and committed online. Installation is PWA, not an existing APK/IPA build.

- Qualification requires a saved draft, immutable submitted revision, distinct authorized reviewer, justified return, optimistic versions and atomic audited approval/conversion. Do not permit generic Party updates to approve or modify credit/payment. Transfer makes pending snapshot stale; require return/resubmission before approval. Preserve legacy identities and offer explicit regularization.
- Subscription capacity belongs to tenant, not company/session. Count active Memberships including administrators. All consumption/reactivation and master limit edits must serialize on Tenant.licenseRevision and commit with audit. Never allow capacity below active usage or frontend trial timestamps. Existing paid tenants must not acquire retroactive trials; reactivation must not restart trials.
- Password visibility is local and explicit per field; never persist/log plaintext. Offline authorization must honor trial/session expiry and current tenant/portfolio on synchronization.
- Offline uses one explicit encrypted IndexedDB vault, not HTTP response caching or a forged online account. Never persist credentials/keys/plaintext portfolio in localStorage. Honor lease/trial bounds, explicit logout loss warning, cross-tab CAS and current identity checks before renewal/sync. Pending items retain original grant and operation IDs.
- Offline receipt/hash and effects/audit must commit atomically. Only confirmed version conflicts may create an explicit new attempt; network/5xx/uncertain replies reuse the same ID. Store device visit times/positions as untrusted offline reports with a separate server receipt; never fabricate online check-in/out. Actor serialization must protect online/imported overlapping attendance.

- Technical work uses explicit tenant/company-scoped service assignments, separate from seller portfolio ownership. Never grant technicians the entire Party portfolio or reuse commercial offline grants. Supervisor technical visibility requires live subordinate membership and authorized regions. Service appointments are manual until reviewed orders exist; scheduling/GPS never proves a sale or billable hours. Serialize technical, seller and imported attendance through the actor; do not orphan active technical work when archiving Party. Location is per-operation and untrusted, not continuous tracking.

- Proposals belong to an open opportunity and its live Party. The server computes line totals from catalog snapshots, freezes sent revisions and stamps decision times; never accept totals, numbers or reference prices from input. Acceptance is not an order or revenue. Fixed pipeline phases keep configurable labels/probabilities; won=100 and lost=0 are set by the server.

- Attendance location (property/equipment) must belong to the live Party; opportunity activities inherit the opportunity location. Territory filters use the property region, never the seller portfolio or a frontend-trusted region, and apply after Party scope and before counts.

- Tickets require a property of the live Party; queue scope follows profile (company, coordination territory by property region, commercial portfolio, or assigned technician) before counts. Only coordination/administrator triage. Opening, first response, resolution and cancellation instants come from the server; only the agreed deadline is typed. Assignment history is immutable; closing requires a solution.
