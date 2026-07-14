# Artificial Wit — Platform Guide (Dynamic vs Custom Pages)

How this app builds pages, how data flows, and the exact recipes for adding features.
Written during the CRM module build (Jul 2026). Keep updated when conventions change.

---

## 1. Architecture & data flow

```
Browser → HttpHelper.rpc('fn_name', params)            (src/lib/http.ts)
        → POST {NEXT_PUBLIC_AW_API_BASE_URL}/rest/{fn}  (api.artificialwit.com)
        → PostgREST (Supabase) → Postgres function
        → returns envelope: { is_success, data, message, status_code, paging }
```

- **Schema-qualified functions work**: `HttpHelper.rpc('crm.fn_get_leads')` → the API sets
  `Content-Profile: crm` and calls `/rpc/fn_get_leads`. The schema must be in PostgREST's
  exposed schemas. Note: `pgrst.db_schemas` is set as a role-level GUC on `authenticator`
  (overrides the dashboard setting!): currently `public, seminar, edu, ess, crm`.
  After adding a schema or new functions run: `NOTIFY pgrst, 'reload schema';`
- **RPC cache**: `HttpHelper.rpc` dedupes identical calls for 3s. After mutations call
  `HttpHelper.rpcInvalidate(fn, params)`.
- **Auth context inside SQL**: every function starts with
  `SELECT tenant_id, user_id INTO ... FROM public.fn_get_request_context('<fn name>')`
  (resolves identity from JWT `auth.uid()` or `x-api-key` header).
- **Envelope helpers**: `public.fn_response_success(p_data, p_message, p_total_records, p_page_size, p_page_index)`
  and `public.fn_response_error(p_function_name, p_message, p_data, p_tenant_id, p_user_id)`.

### Postgres function conventions
- Prefix `fn_`, domain schema (`crm.fn_*`), `SECURITY DEFINER`, `SET search_path = crm, public`.
- Wrap body in `BEGIN … EXCEPTION WHEN OTHERS THEN RETURN fn_response_error(...)`.
- Tenant-scope every query: `WHERE t.tenant_id = v_tenant_id AND t.is_active`.
- Soft delete = `is_active = false`. Guard deletes that would orphan children
  (see `crm.fn_delete_pipeline` / `fn_delete_pipeline_stage`).
- Partial updates: `COALESCE(p_x, x)`; FK params use `0` = clear, `NULL` = unchanged
  (the API strips nulls from the request body, so NULL params never arrive).

### Table conventions (see crm schema for reference)
bigint identity `id`, `tenant_id` FK → tenants, `data/metadata/access_control` jsonb,
`is_active`, `created_by/created_at/updated_by/updated_at`, RLS policy
`tenant_id = get_current_tenant_id()`, trigger `public.update_updated_at()`.

---

## 2. DYNAMIC pages (zero code — pure DB configuration)

Use for: standard CRUD lists + forms. Examples: `/leads`, `/accounts`, `/contacts`,
`/pipelines`, `/pipeline_stages`, `/currency_rates`.

A route not matched by `resolveLocalPage()` in `src/app/(shell)/[section]/page.tsx`
falls through to `<DynamicPage>`, which loads config via `fn_get_page_schema(route)`.

### Recipe — new dynamic page
1. **Functions**: `fn_get_<x>_report()` (flat array for the table), `fn_get_<x>(p_id)`
   (single record for the form), `fn_save_<x>(p_id default null, …)` (insert/update),
   `fn_delete_<x>(p_id)`. Plus `fn_get_<x>_list()` per dropdown, returning `[{id, name}]`.
2. **pages row**: `route_name`, `parent_page_id` (CRM group id), `display_location_id 17`
   (sidebar; 19 = hidden), `platform_id 21`, `page_type_id 23`, `binding_type_id 25`,
   `binding_name_get/post/delete`, `binding_id_name 'id'`,
   `data`: `{item_icon, tool_descr, open_mode: 'panel'}`.
3. **tenant_pages**: one row per tenant that should see it (tenants 1,2,3,10 bypass).
4. **page_sections**:
   - Form: `child_display_mode_id 31`, `display_mode_id 28` (expand).
   - Report table: `child_display_mode_id 39`, `display_mode_id 30` (none),
     `binding_name = 'crm.fn_get_x_report'`.
5. **section_controls** (columns and fields):
   - `control_type_id`: 1 text · 3 email · 5 datetime · 8 int · 9 decimal · 10 checkbox(table)
     · 12 dropdown · 13 textarea · 25 currency · 30 switch(form) · 15 hyperlink
     · 35 deleteTableRow · 42 functionCall (full list: `APP_CONSTANTS.control_types`).
   - `display_mode_id`: 33 visible · 34 required · 37 hidden.
   - Form field width: `data: {"width": 6}` (12-col convention).
   - **Dropdowns**: `binding_list_page_id` → a *hidden* pages row (display_location 19)
     whose `binding_name_get` returns the options. Existing list pages:
     `crm_owner_list`, `crm_account_list`, `crm_pipeline_list`, `crm_stage_type_list`,
     `crm_currency_list`, `lead_status_list`, `lead_rating_list`, `lead_source_list`,
     `account_type_list`.

### Row actions in report tables
- **Open in panel** (type 15): `data.default_value = '/<own_route>?id={id}'` — when the URL
  pathname equals the page's own route, `onRecordSelect` intercepts and opens the record
  panel instead of navigating.
- **Navigate** (type 15): any other pathname → `router.push` (e.g. accounts' Eye action →
  `/account_detail?id={id}`).
- **Delete row** (type 35): `binding_name` = the delete function; confirm dialog built in.
- **Call a function** (type 42): `data = { fn_name, params: {p_x: "{field}", literal: true},
  confirm_message ("{field}" templating), confirm_label, variant, item_icon, item_color,
  hide_when: {field: value} }`. Example: leads' Convert → `crm.fn_convert_lead`.

### Panel mode (`pages.data.open_mode = 'panel'`)
Records open in a right slide-over (560px) instead of full-page record mode; the report
table stays visible and refreshes on save/delete; header gets a **+ New** button.
Implemented in `DynamicPage.tsx` (`panelMode`, `closePanel`, `openNewRecordPanel`).

### Server-side pagination (opt-in per section)
- Flip `page_sections.data.server_paging = true`.
- The report function must accept `(p_filter jsonb, p_paging jsonb, p_sorting jsonb, p_search text)`
  — all defaulted so no-arg calls still return everything — whitelist the sort column,
  and return `p_total_records`. Reference implementation: `crm.fn_get_leads_report`.
  - `p_paging` → `{page_index, page_size}`, parsed via `fn_get_paging`.
  - `p_filter` → `{binding_name: value}` built from the section's per-column Filters row,
    resolved via `fn_get_where_clause` (equality / `{"op": "IN"|"NOT IN"|"="|"!="|"<"|">"|"<="|">=", "val": ...}`).
  - `p_sorting` → `{sort_by, sort_dir}` from the clicked column header.
  - `p_search` → debounced free-text from the global search box.
- XLSX export acts on the current page only.

---

## 3. CUSTOM pages (code)

Use for: composed/interactive UIs the form+table engine can't express
(Kanban drag-drop, 360 views, dashboards).

- Register the route in `resolveLocalPage()` in `src/app/(shell)/[section]/page.tsx`.
- Components live in `src/components/crm/` (or feature folder). `'use client'`.
- Existing: `DealsKanbanPage`, `NewDealModal`, `DealDrawer`, `Account360Page`,
  `CrmDashboardPage`.
- A custom page still needs a `pages` + `tenant_pages` row if it should appear in the
  sidebar (`account_detail` has none — reached only via links).

### UI conventions (match these exactly)
- **Page header** (copy from DynamicPage): frozen bar `px-6 py-3.5 border-b` on
  `--c-topbar`; mobile hamburger `useAppStore().setSidebarOpen(true)` (`lg:hidden`);
  8×8 icon tile (`--c-active` bg, icon in `--c-primary`); 15px semibold title with 11px
  muted subtitle underneath; actions on the right.
- **Colors**: only CSS variables (`--c-base/panel/rail/topbar/border/border-strong/
  hover/active/t1..t5/primary/primary-light`). Never hardcode theme colors
  (exceptions: `#16a34a` success, `#ef4444`/`#d97706` status accents).
- **Form labels**: `text-[11px] font-semibold uppercase tracking-wide` in `--c-t4`;
  required mark `<span className="ml-0.5" style={{color:'#ef4444'}}>*</span>`.
- **Dropdowns**: always `SearchableDropdown` (`@/components/dynamic/SearchableDropdown`,
  options `{id, name}`, clear → `null`). Never native `<select>`.
- **Grid alignment**: filters/KPI/content columns share one grid —
  `grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6` (span 2 for wide content).
- **Feedback**: `toast` from `sonner`; confirm via `@/components/common/ConfirmDialog`.
- **Slide-overs**: fixed right, `max-w-[440–560px]`, backdrop `rgba(0,0,0,0.35)`,
  close on backdrop mousedown.
- **Money**: `Intl.NumberFormat` compact (`en-IN` for INR). KPIs/aggregates are converted
  to base currency (INR) via `crm.currency_rates` (`base_amount` per deal, missing rate
  = 1:1); individual records display native currency.
- No horizontal scroll-snap on desktop boards (fights user scrolling).

---

## 4. Workflow rules

1. Explore existing conventions before adding anything; mirror them.
2. After DB changes: test functions with a simulated JWT —
   `set_config('request.jwt.claims', json_build_object('sub', <profiles.user_id uuid>,
   'role','authenticated')::text, false)` — and always `npx tsc --noEmit` after TS edits.
3. New/changed functions in exposed schemas → `NOTIFY pgrst, 'reload schema';`.
4. **Never run UPDATE/DELETE on live data without explicit user approval** — show the SQL
   first. Additive config INSERTs and function DDL are okay but should be mentioned.
5. Deal stage changes go through `crm.deals` triggers (`fn_sync_deal_from_stage`,
   `fn_log_deal_stage_history`) — never set `status/probability/won_at` directly.
6. CRM sidebar group: pages under parent route `crm` (module 'CRM'), display_order:
   Dashboard 0, Deals 1, Leads 2, Accounts 3, Contacts 4, Pipelines 5, Stages 6,
   Currency Rates 7.
