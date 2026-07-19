-- ============================================================================
-- 03. ROW LEVEL SECURITY — tenant isolation on all tables
-- Standard: policy name {table}_tenant_isolation, TO public,
--           tenant_id = get_current_tenant_id()
-- Improvements over the base standard (deliberate):
--   1. WITH CHECK added — USING alone does NOT constrain INSERT/UPDATE new rows;
--      without it a client could insert rows for another tenant.
--   2. get_current_tenant_id() wrapped in (select ...) so the planner runs it
--      once per statement (InitPlan) instead of per row (Supabase advisor rec).
--   3. Special cases: tenants (id = current tenant), permissions (global rows
--      with tenant_id is null are readable by all tenants).
-- Assumes get_current_tenant_id() exists, is STABLE, and returns NULL for anon.
-- NOTE: SECURITY DEFINER RPCs bypass RLS; these policies protect direct
--       PostgREST table access. Consider also revoking table-level privileges
--       from anon/authenticated to force all writes through RPCs.
-- ============================================================================

alter table public.tenants enable row level security;
drop policy if exists "tenants_tenant_isolation" on public.tenants;
create policy "tenants_tenant_isolation"
on public.tenants to public
using (id = (select get_current_tenant_id()))
with check (id = (select get_current_tenant_id()));

alter table public.users enable row level security;
drop policy if exists "users_tenant_isolation" on public.users;
create policy "users_tenant_isolation"
on public.users to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.roles enable row level security;
drop policy if exists "roles_tenant_isolation" on public.roles;
create policy "roles_tenant_isolation"
on public.roles to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.permissions enable row level security;
drop policy if exists "permissions_tenant_isolation" on public.permissions;
create policy "permissions_tenant_isolation"
on public.permissions to public
using (tenant_id is null or tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.role_permissions enable row level security;
drop policy if exists "role_permissions_tenant_isolation" on public.role_permissions;
create policy "role_permissions_tenant_isolation"
on public.role_permissions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.user_roles enable row level security;
drop policy if exists "user_roles_tenant_isolation" on public.user_roles;
create policy "user_roles_tenant_isolation"
on public.user_roles to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.departments enable row level security;
drop policy if exists "departments_tenant_isolation" on public.departments;
create policy "departments_tenant_isolation"
on public.departments to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.cost_centers enable row level security;
drop policy if exists "cost_centers_tenant_isolation" on public.cost_centers;
create policy "cost_centers_tenant_isolation"
on public.cost_centers to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.locations enable row level security;
drop policy if exists "locations_tenant_isolation" on public.locations;
create policy "locations_tenant_isolation"
on public.locations to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.currencies enable row level security;
drop policy if exists "currencies_tenant_isolation" on public.currencies;
create policy "currencies_tenant_isolation"
on public.currencies to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.uoms enable row level security;
drop policy if exists "uoms_tenant_isolation" on public.uoms;
create policy "uoms_tenant_isolation"
on public.uoms to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.tax_codes enable row level security;
drop policy if exists "tax_codes_tenant_isolation" on public.tax_codes;
create policy "tax_codes_tenant_isolation"
on public.tax_codes to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.categories enable row level security;
drop policy if exists "categories_tenant_isolation" on public.categories;
create policy "categories_tenant_isolation"
on public.categories to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.conditions enable row level security;
drop policy if exists "conditions_tenant_isolation" on public.conditions;
create policy "conditions_tenant_isolation"
on public.conditions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.movement_types enable row level security;
drop policy if exists "movement_types_tenant_isolation" on public.movement_types;
create policy "movement_types_tenant_isolation"
on public.movement_types to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.vendors enable row level security;
drop policy if exists "vendors_tenant_isolation" on public.vendors;
create policy "vendors_tenant_isolation"
on public.vendors to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.vendor_contacts enable row level security;
drop policy if exists "vendor_contacts_tenant_isolation" on public.vendor_contacts;
create policy "vendor_contacts_tenant_isolation"
on public.vendor_contacts to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.items enable row level security;
drop policy if exists "items_tenant_isolation" on public.items;
create policy "items_tenant_isolation"
on public.items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.number_series enable row level security;
drop policy if exists "number_series_tenant_isolation" on public.number_series;
create policy "number_series_tenant_isolation"
on public.number_series to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.app_settings enable row level security;
drop policy if exists "app_settings_tenant_isolation" on public.app_settings;
create policy "app_settings_tenant_isolation"
on public.app_settings to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.workflow_definitions enable row level security;
drop policy if exists "workflow_definitions_tenant_isolation" on public.workflow_definitions;
create policy "workflow_definitions_tenant_isolation"
on public.workflow_definitions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.workflow_steps enable row level security;
drop policy if exists "workflow_steps_tenant_isolation" on public.workflow_steps;
create policy "workflow_steps_tenant_isolation"
on public.workflow_steps to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.workflow_instances enable row level security;
drop policy if exists "workflow_instances_tenant_isolation" on public.workflow_instances;
create policy "workflow_instances_tenant_isolation"
on public.workflow_instances to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.workflow_actions enable row level security;
drop policy if exists "workflow_actions_tenant_isolation" on public.workflow_actions;
create policy "workflow_actions_tenant_isolation"
on public.workflow_actions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.approval_delegations enable row level security;
drop policy if exists "approval_delegations_tenant_isolation" on public.approval_delegations;
create policy "approval_delegations_tenant_isolation"
on public.approval_delegations to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_requisitions enable row level security;
drop policy if exists "purchase_requisitions_tenant_isolation" on public.purchase_requisitions;
create policy "purchase_requisitions_tenant_isolation"
on public.purchase_requisitions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_requisition_items enable row level security;
drop policy if exists "purchase_requisition_items_tenant_isolation" on public.purchase_requisition_items;
create policy "purchase_requisition_items_tenant_isolation"
on public.purchase_requisition_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.rfqs enable row level security;
drop policy if exists "rfqs_tenant_isolation" on public.rfqs;
create policy "rfqs_tenant_isolation"
on public.rfqs to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.rfq_items enable row level security;
drop policy if exists "rfq_items_tenant_isolation" on public.rfq_items;
create policy "rfq_items_tenant_isolation"
on public.rfq_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.rfq_vendors enable row level security;
drop policy if exists "rfq_vendors_tenant_isolation" on public.rfq_vendors;
create policy "rfq_vendors_tenant_isolation"
on public.rfq_vendors to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.vendor_quotations enable row level security;
drop policy if exists "vendor_quotations_tenant_isolation" on public.vendor_quotations;
create policy "vendor_quotations_tenant_isolation"
on public.vendor_quotations to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.vendor_quotation_items enable row level security;
drop policy if exists "vendor_quotation_items_tenant_isolation" on public.vendor_quotation_items;
create policy "vendor_quotation_items_tenant_isolation"
on public.vendor_quotation_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_orders enable row level security;
drop policy if exists "purchase_orders_tenant_isolation" on public.purchase_orders;
create policy "purchase_orders_tenant_isolation"
on public.purchase_orders to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_order_items enable row level security;
drop policy if exists "purchase_order_items_tenant_isolation" on public.purchase_order_items;
create policy "purchase_order_items_tenant_isolation"
on public.purchase_order_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.goods_receipts enable row level security;
drop policy if exists "goods_receipts_tenant_isolation" on public.goods_receipts;
create policy "goods_receipts_tenant_isolation"
on public.goods_receipts to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.goods_receipt_items enable row level security;
drop policy if exists "goods_receipt_items_tenant_isolation" on public.goods_receipt_items;
create policy "goods_receipt_items_tenant_isolation"
on public.goods_receipt_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_invoices enable row level security;
drop policy if exists "purchase_invoices_tenant_isolation" on public.purchase_invoices;
create policy "purchase_invoices_tenant_isolation"
on public.purchase_invoices to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.purchase_invoice_items enable row level security;
drop policy if exists "purchase_invoice_items_tenant_isolation" on public.purchase_invoice_items;
create policy "purchase_invoice_items_tenant_isolation"
on public.purchase_invoice_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.vendor_payments enable row level security;
drop policy if exists "vendor_payments_tenant_isolation" on public.vendor_payments;
create policy "vendor_payments_tenant_isolation"
on public.vendor_payments to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.warehouses enable row level security;
drop policy if exists "warehouses_tenant_isolation" on public.warehouses;
create policy "warehouses_tenant_isolation"
on public.warehouses to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.item_stocks enable row level security;
drop policy if exists "item_stocks_tenant_isolation" on public.item_stocks;
create policy "item_stocks_tenant_isolation"
on public.item_stocks to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.stock_transactions enable row level security;
drop policy if exists "stock_transactions_tenant_isolation" on public.stock_transactions;
create policy "stock_transactions_tenant_isolation"
on public.stock_transactions to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.depreciation_methods enable row level security;
drop policy if exists "depreciation_methods_tenant_isolation" on public.depreciation_methods;
create policy "depreciation_methods_tenant_isolation"
on public.depreciation_methods to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.assets enable row level security;
drop policy if exists "assets_tenant_isolation" on public.assets;
create policy "assets_tenant_isolation"
on public.assets to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_movements enable row level security;
drop policy if exists "asset_movements_tenant_isolation" on public.asset_movements;
create policy "asset_movements_tenant_isolation"
on public.asset_movements to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_transfers enable row level security;
drop policy if exists "asset_transfers_tenant_isolation" on public.asset_transfers;
create policy "asset_transfers_tenant_isolation"
on public.asset_transfers to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_transfer_items enable row level security;
drop policy if exists "asset_transfer_items_tenant_isolation" on public.asset_transfer_items;
create policy "asset_transfer_items_tenant_isolation"
on public.asset_transfer_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_depreciation_schedules enable row level security;
drop policy if exists "asset_depreciation_schedules_tenant_isolation" on public.asset_depreciation_schedules;
create policy "asset_depreciation_schedules_tenant_isolation"
on public.asset_depreciation_schedules to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_depreciation_entries enable row level security;
drop policy if exists "asset_depreciation_entries_tenant_isolation" on public.asset_depreciation_entries;
create policy "asset_depreciation_entries_tenant_isolation"
on public.asset_depreciation_entries to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_warranties enable row level security;
drop policy if exists "asset_warranties_tenant_isolation" on public.asset_warranties;
create policy "asset_warranties_tenant_isolation"
on public.asset_warranties to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_disposals enable row level security;
drop policy if exists "asset_disposals_tenant_isolation" on public.asset_disposals;
create policy "asset_disposals_tenant_isolation"
on public.asset_disposals to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_audits enable row level security;
drop policy if exists "asset_audits_tenant_isolation" on public.asset_audits;
create policy "asset_audits_tenant_isolation"
on public.asset_audits to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.asset_audit_items enable row level security;
drop policy if exists "asset_audit_items_tenant_isolation" on public.asset_audit_items;
create policy "asset_audit_items_tenant_isolation"
on public.asset_audit_items to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.maintenance_plans enable row level security;
drop policy if exists "maintenance_plans_tenant_isolation" on public.maintenance_plans;
create policy "maintenance_plans_tenant_isolation"
on public.maintenance_plans to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.maintenance_schedules enable row level security;
drop policy if exists "maintenance_schedules_tenant_isolation" on public.maintenance_schedules;
create policy "maintenance_schedules_tenant_isolation"
on public.maintenance_schedules to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.maintenance_work_orders enable row level security;
drop policy if exists "maintenance_work_orders_tenant_isolation" on public.maintenance_work_orders;
create policy "maintenance_work_orders_tenant_isolation"
on public.maintenance_work_orders to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.maintenance_work_order_tasks enable row level security;
drop policy if exists "maintenance_work_order_tasks_tenant_isolation" on public.maintenance_work_order_tasks;
create policy "maintenance_work_order_tasks_tenant_isolation"
on public.maintenance_work_order_tasks to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.maintenance_work_order_parts enable row level security;
drop policy if exists "maintenance_work_order_parts_tenant_isolation" on public.maintenance_work_order_parts;
create policy "maintenance_work_order_parts_tenant_isolation"
on public.maintenance_work_order_parts to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.sla_policies enable row level security;
drop policy if exists "sla_policies_tenant_isolation" on public.sla_policies;
create policy "sla_policies_tenant_isolation"
on public.sla_policies to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.tickets enable row level security;
drop policy if exists "tickets_tenant_isolation" on public.tickets;
create policy "tickets_tenant_isolation"
on public.tickets to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.ticket_comments enable row level security;
drop policy if exists "ticket_comments_tenant_isolation" on public.ticket_comments;
create policy "ticket_comments_tenant_isolation"
on public.ticket_comments to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.ticket_activities enable row level security;
drop policy if exists "ticket_activities_tenant_isolation" on public.ticket_activities;
create policy "ticket_activities_tenant_isolation"
on public.ticket_activities to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.attachments enable row level security;
drop policy if exists "attachments_tenant_isolation" on public.attachments;
create policy "attachments_tenant_isolation"
on public.attachments to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.notifications enable row level security;
drop policy if exists "notifications_tenant_isolation" on public.notifications;
create policy "notifications_tenant_isolation"
on public.notifications to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));

alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs_tenant_isolation" on public.audit_logs;
create policy "audit_logs_tenant_isolation"
on public.audit_logs to public
using (tenant_id = (select get_current_tenant_id()))
with check (tenant_id = (select get_current_tenant_id()));
