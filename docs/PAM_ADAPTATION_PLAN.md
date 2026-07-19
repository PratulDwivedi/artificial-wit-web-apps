# PAM Adaptation Plan — Procurement & Asset Management

Adapting the 7 SQL files from the "Procurement asset management database" session into the
live platform, following the CRM playbook. Directives confirmed by Pratul:

1. New **`pam`** schema for all procurement/asset tables.
2. **Reuse `public`** for: `tenants`, `profiles` (replaces `users`), `roles`, `user_roles`,
   `locations`, `categories`.
3. Report functions: `fn_get_<x>_report(p_filter jsonb, p_paging jsonb, p_sorting jsonb, p_search text)`
   — the new standard (reference: rewritten `crm.fn_get_leads_report`; client already updated).
4. Saves use **named `p_*` params**, not `p_payload jsonb`. Line-item grids still arrive as a
   jsonb array param (`p_items`) because the engine posts table sections as
   `p_<section_binding_name> = [rows]` — that is by design, not a payload object.

---

## 1. Table disposition matrix (65 tables)

### DROP from scripts — reuse existing `public` tables (remap FKs)
| Source table | Reuse | Notes |
|---|---|---|
| tenants | `public.tenants` | as-is |
| users | `public.profiles` | all `user_id`/`created_by` FKs remap to `profiles.id`; audit uses `v_ctx.caller_id` |
| roles | `public.roles` | workflow approver `role_id` points here |
| user_roles | `public.user_roles` | as-is |
| locations | `public.locations` | hierarchical (parent_id/path) — fits |
| categories | `public.categories` | shared category tree |

### CREATE in `pam` (54 tables)
- **Org refs**: departments, cost_centers, uoms, tax_codes, conditions, movement_types,
  warehouses, depreciation_methods
- **Vendors/items**: vendors, vendor_contacts, items *(see open question 2)*
- **Numbering**: number_series (+ gap-free `fn_get_next_doc_number`, FOR UPDATE lock)
- **Workflow engine**: workflow_definitions, workflow_steps, workflow_instances,
  workflow_actions, approval_delegations
- **P2P chain**: purchase_requisitions(+items), rfqs(+items,+vendors),
  vendor_quotations(+items), purchase_orders(+items), goods_receipts(+items),
  purchase_invoices(+items), vendor_payments
- **Inventory**: item_stocks, stock_transactions
- **Assets**: assets, asset_movements, asset_transfers(+items),
  asset_depreciation_schedules, asset_depreciation_entries, asset_warranties,
  asset_disposals, asset_audits(+items)
- **Maintenance**: maintenance_plans, maintenance_schedules,
  maintenance_work_orders(+tasks,+parts)

### DEFER / replace with existing platform features (open questions below)
| Source table | Existing equivalent | Proposal |
|---|---|---|
| permissions, role_permissions | none in public | Q1 |
| tickets, ticket_comments, ticket_activities, sla_policies | `public.tickets` module (513 rows, live UI) | Q3 |
| currencies | `crm.currency_rates` | Q4 |
| attachments | `public.file_metadata` + storage flow | skip, reuse |
| notifications | platform hub (`NotificationHubContext`) | skip, reuse |
| audit_logs | `public.api_logs`/`error_logs`/`workflow_history` | skip or keep `pam.audit_logs`? Q5 |
| app_settings | `public.global_variables` | skip, reuse |

All `pam` tables follow platform conventions: `tenant_id` FK → `public.tenants`, jsonb
`data/metadata/access_control`, `is_active`, audit columns, `update_updated_at` trigger.

---

## 2. Infrastructure steps

1. `CREATE SCHEMA pam` + `GRANT USAGE` + default privileges (same as crm migration).
2. **Expose schema** — needs your manual run (role-level GUC overrides dashboard):
   `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, seminar, edu, ess, crm, pam';`
   then `NOTIFY pgrst, 'reload config';`
3. RLS on every pam table — file 03 pattern kept: `USING` **and** `WITH CHECK`, with
   `(select get_current_tenant_id())` InitPlan form.
4. Soft-delete unique conflicts — file 02 pattern: partial unique indexes
   (`WHERE is_active = true`) instead of plain unique constraints, applied at create time.
5. Seeds (INSERTs, will show before running): movement_types (ALLOCATE, DEALLOCATE,
   TRANSFER, DISPOSAL…), depreciation_methods, number_series rows per tenant/doc type,
   uoms/tax_codes/conditions starters.

---

## 3. Function conversion rules (files 04 + 06 → `pam.fn_*`)

- Schema `pam`, `SECURITY DEFINER`, `SET search_path TO 'pam', 'public'`,
  `v_ctx t_request_context := public.fn_get_request_context('pam.fn_x')`.
- **Reports** → new standard signature `(p_filter, p_paging, p_sorting, p_search)` using
  `fn_get_paging` + `fn_get_where_clause`, sort-column whitelist, `tenant_id` stripped
  from output rows. Renames: `fn_list_assets` → `fn_get_assets_report`,
  `fn_list_purchase_orders` → `fn_get_purchase_orders_report`, etc.
- **Single get** `fn_get_<x>(p_id)`; **saves** `fn_save_<x>(p_id default null, p_* …)` with
  named params matching form control binding names (engine posts `p_<binding_name>`);
  line grids as `p_items jsonb` / `p_tasks jsonb` arrays. **Drop the three `_ui` wrappers**
  — named params make them unnecessary.
- **Deletes** `fn_delete_<x>(p_id)` with reference guards (e.g. can't delete a PO that has
  GRNs; can't delete an asset with open work orders).
- Keep the good domain logic as-is: PR submit picks workflow by amount range,
  `fn_action_workflow_step` generic approve/reject/return with delegation resolution,
  GRN qty validation against PO lines, WO cost roll-up, SLA due-date computation
  (if tickets stay — Q3).
- Dropdown list functions per new masters: `fn_get_vendor_list`, `fn_get_item_list`,
  `fn_get_warehouse_list`, `fn_get_cost_center_list`, `fn_get_department_list`,
  `fn_get_uom_list`, `fn_get_condition_list`, `fn_get_movement_type_list`… each behind a
  hidden list page for `binding_list_page_id`.

---

## 4. UI configuration (files 05 + 07 → new seeds)

- New `modules` row **PAM** + sidebar group(s) — grouping decision is Q6.
- Lookup IDs used by the old seeds are **confirmed correct** from the CRM build
  (17/19 locations, 23 form page type, 25 binding type, 20/21 platforms,
  28/30/31/32/39 section modes, 33/34/36/37 control modes).
- Pages to configure (dynamic, DB-only):
  - Masters (panel mode like CRM): vendors, items, warehouses, cost centers, departments,
    uoms, tax codes, conditions, movement types, number series
  - Documents (**full-page record mode**, not panel — item grids need width):
    Purchase Requisition (Details + Items grid + list), Purchase Order, Goods Receipt,
    Asset (register + lifecycle fields), Asset Transfer, Work Order (with tasks grid)
  - Action/report pages: Asset Allocation (named-param form), Approval Inbox
    (report + Act link → workflow action form), Pending lists
- Row actions reuse the proven set: Pencil edit, Eye navigate, delete (35),
  and functionCall (42) is a good fit for workflow approve/reject later.
- Candidate **custom pages** (phase 2, like CRM's Kanban/dashboard): Asset 360 view,
  Procurement dashboard (spend funnel, pending approvals, stock alerts),
  approval action UI if the generic form proves clunky.

---

## 5. Apply order

1. `pam` schema + grants + (you run) `authenticator` GUC + reload
2. Adapted table DDL (54 tables, partial unique indexes inline)
3. RLS policies
4. Converted functions (core + supplement + list functions) + `NOTIFY pgrst, 'reload schema'`
5. Reference seeds (shown for approval first)
6. UI seeds (module, pages, sections, controls, tenant_pages)
7. End-to-end verification with simulated JWT per document flow (PR → submit → approve →
   PO → GRN; asset → allocate → transfer)

---

## 6. DECISIONS (confirmed by Pratul, 17-Jul-2026)

1. **permissions / role_permissions** — **DROPPED**. Authorization uses the platform's
   per-record `access_control` jsonb (scope: private/protected/public; protected lists role
   ids) + existing `roles`/`user_roles`. Workflow approver checks query roles directly.
2. **vendors & items** — **create fresh in `pam`** (`pam.vendors`, `pam.vendor_contacts`,
   `pam.items`). Existing empty `public.vendors`/`public.items` stay untouched for now.
3. **Tickets/SLA** — **separate pam helpdesk**: `pam.tickets`, `pam.ticket_comments`,
   `pam.ticket_activities`, `pam.sla_policies`. Existing `public.tickets` module unaffected.
4. **currencies** — **`public.currencies`** (shared master). `crm.currency_rates` code/data
   migrates to public when convenient (tracked as follow-up; CRM keeps working meanwhile).
5. **audit_logs** — **keep `pam.audit_logs`** for document compliance; enhance later.
6. **Sidebar grouping** (my call, per Pratul): new top-level group **"Procurement"** for
   P2P + inventory + vendors/items + masters; new asset lifecycle + maintenance pages go
   under the existing **"Asset Management"** group. The old Asset page (bound to
   `public.assets`, empty table) stays until pam pages are verified, then is deactivated
   and any data migrated (currently 0 rows).
7. **departments / cost_centers** — **`public` schema** (org-wide masters).
