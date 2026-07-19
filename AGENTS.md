<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Platform rules (dynamic pages, custom pages, UI, DB)

**Full guide: `docs/PLATFORM_GUIDE.md` — read it before building any page or DB function.**
**Current state + pending work: `docs/PROJECT_STATUS.md` — read at session start.**

Condensed rules that always apply:

1. **Prefer DYNAMIC pages over code.** Standard CRUD (list + form) is configured entirely in
   DB tables `pages` / `page_sections` / `section_controls` — no React code. Only build a
   CUSTOM component (registered in `resolveLocalPage()` in `src/app/(shell)/[section]/page.tsx`)
   for composed/interactive UIs: Kanban, 360 views, dashboards.
2. **Data flow**: `HttpHelper.rpc('crm.fn_x', params)` → `/rest/{fn}` → Postgres function →
   envelope `{is_success, data, message, paging}`. Functions: `fn_` prefix, SECURITY DEFINER,
   get context via `fn_get_request_context`, respond via `fn_response_success/error`,
   tenant-scope every query, soft delete via `is_active`. After creating/altering functions:
   `NOTIFY pgrst, 'reload schema';`. Invalidate the 3s RPC cache after mutations
   (`HttpHelper.rpcInvalidate`).
3. **UI conventions for custom pages**: DynamicPage-style frozen header (hamburger + 8×8 icon
   tile + title with 11px subtitle below); CSS variables only (`--c-*`); labels
   `text-[11px] font-semibold uppercase tracking-wide` + red `*` for required; dropdowns are
   always `SearchableDropdown` (never native `<select>`); filters/KPIs/content share the
   `grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6` grid; `sonner` toasts;
   `ConfirmDialog` for confirms.
4. **Special dynamic-engine features**: `pages.data.open_mode='panel'` (records edit in a
   slide-over); control type 42 `functionCall` (row action → RPC with confirm);
   `page_sections.data.server_paging=true` + paged report fn (copy `crm.fn_get_leads_report`).
5. **Safety**: never run UPDATE/DELETE on live data without showing the SQL and getting
   approval. Test DB functions with a simulated JWT; run `npx tsc --noEmit` after TS changes.
   Deal stage/status fields are trigger-managed — update `stage_id` only.
