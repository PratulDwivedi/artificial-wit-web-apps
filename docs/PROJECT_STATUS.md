# Project Status & Pending Work (session handoff — 18-Jul-2026)

Read this + `docs/PLATFORM_GUIDE.md` + `docs/PAM_ADAPTATION_PLAN.md` at the start of any session.
DB = Supabase project `tpgyuqvncljnuyrohqre` (artificial_wit_db). Test tenant = 2, audit user = 1.
Rule: **never run UPDATE/DELETE on live data without showing SQL and getting approval.**

---

## CRM module (schema `crm`) — COMPLETE & working
- Tables: pipelines, pipeline_stages, accounts, contacts, leads, deals, deal_contacts,
  deal_stage_history, currency_rates. Triggers manage deal status/probability/history —
  update `stage_id` only.
- Pages: crm_dashboard + deals + account_detail (custom code in `src/components/crm/`),
  leads/accounts/contacts/pipelines/pipeline_stages/currency_rates (dynamic, panel mode).
- Engine features added during CRM build: panel mode (`pages.data.open_mode='panel'`),
  functionCall control (type 42), server paging (`section.data.server_paging` +
  `(p_filter,p_paging,p_sorting,p_search)` report signature — reference `crm.fn_get_leads_report`),
  shared datetime formatter (`src/lib/datetime.ts`), DynamicViewRecord date fix.
- CRM deferred: role-based permissions; migrate `crm.currency_rates` → `public.currencies`
  (currencies master table exists in public with exchange_rate; page not built yet).

## PAM module (schema `pam`) — CORE LIVE
- 51 pam tables + public masters (departments, cost_centers, currencies). RLS everywhere
  (USING + WITH CHECK, InitPlan form), partial unique indexes, update_updated_at triggers.
- ~70 functions: assets (CRUD/report/allocate/deallocate), transfers (save/get/report/receive),
  PR (CRUD/report/submit w/ amount-based workflow pick, auto-approve if none), PO (CRUD/report,
  line totals+tax), GRN (CRUD/report, qty guards), work orders (CRUD/report, tasks grid),
  workflow action (approve/reject/return + delegation) + pending-approvals inbox report,
  vendors/items (full CRUD+report), warehouses/uoms/tax_codes/conditions/movement_types CRUD,
  12 dropdown list fns, gap-free `pam.fn_get_next_doc_number`.
- Seeds (tenant 2): movement types (ALLOCATE/DEALLOCATE/TRANSFER/…), depreciation methods,
  conditions, uoms, tax codes, number series.
- UI: "Procurement" sidebar group (PRs w/ Submit action, POs, GRNs, Approval Inbox with
  Approve/Reject/Return functionCalls, Vendors, Items, Warehouses, UoMs, Tax Codes) +
  under existing "Asset Management" group (id 2): asset pages, Asset Allocation form, Work Orders.
- `authenticator` GUC now includes pam: `public, seminar, edu, ess, crm, pam`.

## Asset data migration — DONE
- 4,553 rows migrated `public.assets` → `pam.assets` (tenant 2). Conditions mapped from
  quick_lists ("Asset Condition": Bad→DAMAGED, Worse→SCRAP, rest 1:1); 6 cost centers
  (CC-01…CC-10) created in public.cost_centers from quick_lists and mapped.
- Junk legacy refs preserved in `data.legacy_*` (vendor_id/movement_type_id pointed at UI
  quick_lists; all 349 allocated_to_user_id values matched no profile → status all in_stock).
- `data.legacy_asset_id` = old id (migration idempotent). `public.assets` untouched.
- OPEN: map 349 legacy allocations if user provides id mapping; deactivate old public.assets
  page when user confirms.

## Pratul's manual reorganization (IMPORTANT — differs from original config)
- Route `asset_register` renamed → **`asset`** (page id 245): asset FORM only; its report
  section 152 deactivated.
- Route **`assets`** (page id 28, section 34 "Available Assets", child mode 40 advanced report):
  the asset LIST, repointed to pam report; he added the Deallocate functionCall (copy of
  control 958's config) to section 34 himself — working.
- Control 957 (Edit on dead section 152) still had stale `/asset_register` link — fix given,
  may or may not be applied; section is inactive so harmless.
- Pattern he prefers for assets: form page and list page as separate routes.

## DONE in final session push (verify in UI next session)
- **Approval Workflows page** (`/approval_workflows`, Procurement group): definition form
  (code/name/entity-type dropdown/min-max amount/default switch) + Steps editable grid
  (name, approver type role|user, role/user dropdowns, SLA hours) + report w/ Edit + Delete.
  Fns: fn_get/save/delete_workflow_definition (+steps grid), fn_get_workflow_definitions_report,
  fn_get_role_list / fn_get_wf_entity_type_list / fn_get_approver_type_list (+ hidden pages
  pam_role_list / pam_wf_entity_type_list / pam_approver_type_list).
- **Asset Transfers page** (`/asset_transfers`, Asset Mgmt group): form + assets grid + report
  with Submit (new `pam.fn_submit_asset_transfer` — auto-approve if no workflow) and Receive
  functionCalls. Flow: draft → Submit → (approval) → approved → Receive → assets relocated.
- **Conditions** (`/pam_conditions`) & **Movement Types** (`/pam_movement_types`) master
  pages (panel mode) under Asset Management.
- NOT yet user-tested in browser. hide_when on Submit/Receive is minimal (single-value
  equality) — actions may show on rows where the fn will politely error.

## DONE 18-Jul-2026 — public masters pages (verify in UI)
- **Departments** (`/departments`, page 259), **Cost Centers** (`/cost_centers`, page 260),
  **Currencies** (`/currencies`, page 261) — dynamic panel-mode pages under **Common** group
  (id 55, Pratul's pick), tenant_pages for 2,3,4,5,10,33,34,39 (cloned from page 253's set).
- Fns (public schema, pam.fn_save_condition pattern): fn_get/save/delete_{department,
  cost_center,currency} + fn_get_{departments,cost_centers,currencies}_report (no-arg,
  masters are small) + **public.fn_get_currency_list** with hidden page `currency_list`
  (id 262) for future PAM doc forms. FK params: 0=clear/NULL=unchanged; delete guards
  against pam refs (assets/PRs/POs/invoices/payments/vendors) + child rows.
- Dropdowns reused: pam_department_list (230), pam_cost_center_list (231), user_list (18 —
  fn_get_user_list returns profiles.id, fits head_user_id/owner_user_id).
- Legacy hidden quick-list page 75 route renamed `cost_centers` → **`cost_center_quick_list`**
  (approved; only referenced via binding_list_page_id=75 by controls 126/247 — unaffected)
  to free the route.
- **GOTCHA found**: `fn_get_page_schema` filters page_sections/section_controls by
  `platform_id IN (20, p_platform_id)` — new sections/controls MUST set `platform_id = 21`
  or they silently vanish from the schema. (Was NULL initially; fixed.)
- Verified via simulated JWT (tenant 2, rolled-back txn): reports OK (6 cost centers),
  save→get→update→delete round-trips OK, page schemas return 2 sections each w/ controls.
  NOT yet browser-tested.

## PENDING — next work items (priority order)
5. GRN "PO Line" cascading dropdown (currently raw id entry); PR `ordered_qty` update on PO
   creation; auto asset-creation from GRN serial_numbers.
6. pam helpdesk (tickets/sla_policies — tables only) — separate from public.tickets module.
7. Purchase invoices & payments; RFQ/quotations; disposals & audits (tables only).
8. Preventive maintenance scheduling; depreciation posting runs.
9. Procurement & Asset dashboards (custom pages, like CRM dashboard).
10. Role-based permissions (CRM + PAM) — enforce in fns via v_ctx.role_ids/is_admin;
    authorization model = per-record access_control jsonb (private/protected/public + roles).

## Deliverables in repo
- `docs/PLATFORM_GUIDE.md` — how to build (user maintains; server-paging section reflects
  his latest fn_get_where_clause/fn_get_paging conventions).
- `docs/PAM_ADAPTATION_PLAN.md` — decisions record.
- `docs/presentations/pam_walkthrough_slides.html` — customer-facing 13-slide deck (arrow keys).
- `mockups/` — CRM HTML mockups.
