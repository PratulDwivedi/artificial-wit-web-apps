-- ============================================================================
-- 02. SOFT-DELETE COMPATIBLE UNIQUENESS
-- Converts unique CONSTRAINTS to partial unique INDEXES (where is_active = true)
-- so business codes / numbers can be reused after a soft delete.
-- NOTE: document numbers issued via number_series are monotonic and will not
-- collide anyway; conversion applied uniformly for consistency.
-- ============================================================================

alter table public.tenants drop constraint if exists tenants_code_key;
create unique index if not exists uq_tenants_code
  on public.tenants (code) where is_active = true;

alter table public.users drop constraint if exists users_tenant_email_key;
create unique index if not exists uq_users_tenant_email
  on public.users (tenant_id, email) where is_active = true;

alter table public.roles drop constraint if exists roles_tenant_code_key;
create unique index if not exists uq_roles_tenant_code
  on public.roles (tenant_id, code) where is_active = true;

alter table public.permissions drop constraint if exists permissions_code_key;
create unique index if not exists uq_permissions_code
  on public.permissions (code) where is_active = true;

alter table public.role_permissions drop constraint if exists role_permissions_role_perm_key;
create unique index if not exists uq_role_permissions_role_perm
  on public.role_permissions (tenant_id, role_id, permission_id) where is_active = true;

alter table public.user_roles drop constraint if exists user_roles_user_role_key;
create unique index if not exists uq_user_roles_user_role
  on public.user_roles (tenant_id, user_id, role_id, location_id, department_id) where is_active = true;

alter table public.departments drop constraint if exists departments_tenant_code_key;
create unique index if not exists uq_departments_tenant_code
  on public.departments (tenant_id, code) where is_active = true;

alter table public.cost_centers drop constraint if exists cost_centers_tenant_code_key;
create unique index if not exists uq_cost_centers_tenant_code
  on public.cost_centers (tenant_id, code) where is_active = true;

alter table public.locations drop constraint if exists locations_tenant_code_key;
create unique index if not exists uq_locations_tenant_code
  on public.locations (tenant_id, code) where is_active = true;

alter table public.currencies drop constraint if exists currencies_tenant_code_key;
create unique index if not exists uq_currencies_tenant_code
  on public.currencies (tenant_id, code) where is_active = true;

alter table public.uoms drop constraint if exists uoms_tenant_code_key;
create unique index if not exists uq_uoms_tenant_code
  on public.uoms (tenant_id, code) where is_active = true;

alter table public.tax_codes drop constraint if exists tax_codes_tenant_code_key;
create unique index if not exists uq_tax_codes_tenant_code
  on public.tax_codes (tenant_id, code) where is_active = true;

alter table public.categories drop constraint if exists categories_tenant_type_code_key;
create unique index if not exists uq_categories_tenant_type_code
  on public.categories (tenant_id, category_type, code) where is_active = true;

alter table public.conditions drop constraint if exists conditions_tenant_code_key;
create unique index if not exists uq_conditions_tenant_code
  on public.conditions (tenant_id, code) where is_active = true;

alter table public.movement_types drop constraint if exists movement_types_tenant_code_key;
create unique index if not exists uq_movement_types_tenant_code
  on public.movement_types (tenant_id, code) where is_active = true;

alter table public.vendors drop constraint if exists vendors_tenant_code_key;
create unique index if not exists uq_vendors_tenant_code
  on public.vendors (tenant_id, code) where is_active = true;

alter table public.items drop constraint if exists items_tenant_code_key;
create unique index if not exists uq_items_tenant_code
  on public.items (tenant_id, code) where is_active = true;

alter table public.number_series drop constraint if exists number_series_tenant_doc_fy_key;
create unique index if not exists uq_number_series_tenant_doc_fy
  on public.number_series (tenant_id, doc_type, fiscal_year) where is_active = true;

alter table public.app_settings drop constraint if exists app_settings_tenant_key_key;
create unique index if not exists uq_app_settings_tenant
  on public.app_settings (tenant_id, setting_key) where is_active = true;

alter table public.workflow_definitions drop constraint if exists workflow_definitions_tenant_code_ver_key;
create unique index if not exists uq_workflow_definitions_tenant_code_ver
  on public.workflow_definitions (tenant_id, code, version) where is_active = true;

alter table public.workflow_steps drop constraint if exists workflow_steps_def_step_key;
create unique index if not exists uq_workflow_steps_def_step
  on public.workflow_steps (workflow_definition_id, step_no) where is_active = true;

alter table public.purchase_requisitions drop constraint if exists pr_tenant_number_key;
create unique index if not exists uq_pr_tenant_number
  on public.purchase_requisitions (tenant_id, pr_number) where is_active = true;

alter table public.rfqs drop constraint if exists rfqs_tenant_number_key;
create unique index if not exists uq_rfqs_tenant_number
  on public.rfqs (tenant_id, rfq_number) where is_active = true;

alter table public.rfq_vendors drop constraint if exists rfq_vendors_rfq_vendor_key;
create unique index if not exists uq_rfq_vendors_rfq_vendor
  on public.rfq_vendors (rfq_id, vendor_id) where is_active = true;

alter table public.vendor_quotations drop constraint if exists vq_tenant_number_key;
create unique index if not exists uq_vq_tenant_number
  on public.vendor_quotations (tenant_id, quotation_number) where is_active = true;

alter table public.purchase_orders drop constraint if exists po_tenant_number_key;
create unique index if not exists uq_po_tenant_number
  on public.purchase_orders (tenant_id, po_number) where is_active = true;

alter table public.goods_receipts drop constraint if exists grn_tenant_number_key;
create unique index if not exists uq_grn_tenant_number
  on public.goods_receipts (tenant_id, grn_number) where is_active = true;

alter table public.purchase_invoices drop constraint if exists pinv_tenant_number_key;
create unique index if not exists uq_pinv_tenant_number
  on public.purchase_invoices (tenant_id, invoice_number) where is_active = true;

alter table public.vendor_payments drop constraint if exists vpay_tenant_number_key;
create unique index if not exists uq_vpay_tenant_number
  on public.vendor_payments (tenant_id, payment_number) where is_active = true;

alter table public.warehouses drop constraint if exists warehouses_tenant_code_key;
create unique index if not exists uq_warehouses_tenant_code
  on public.warehouses (tenant_id, code) where is_active = true;

alter table public.item_stocks drop constraint if exists item_stocks_item_wh_key;
create unique index if not exists uq_item_stocks_item_wh
  on public.item_stocks (tenant_id, item_id, warehouse_id) where is_active = true;

alter table public.depreciation_methods drop constraint if exists dep_methods_tenant_code_key;
create unique index if not exists uq_dep_methods_tenant_code
  on public.depreciation_methods (tenant_id, code) where is_active = true;

alter table public.assets drop constraint if exists assets_tenant_code_key;
create unique index if not exists uq_assets_tenant_code
  on public.assets (tenant_id, code) where is_active = true;

alter table public.asset_transfers drop constraint if exists atrf_tenant_number_key;
create unique index if not exists uq_atrf_tenant_number
  on public.asset_transfers (tenant_id, transfer_number) where is_active = true;

alter table public.asset_transfer_items drop constraint if exists atrf_items_transfer_asset_key;
create unique index if not exists uq_atrf_items_transfer_asset
  on public.asset_transfer_items (transfer_id, asset_id) where is_active = true;

alter table public.asset_depreciation_schedules drop constraint if exists adsch_asset_period_key;
create unique index if not exists uq_adsch_asset_period
  on public.asset_depreciation_schedules (asset_id, fiscal_year, period_no) where is_active = true;

alter table public.asset_disposals drop constraint if exists adsp_tenant_number_key;
create unique index if not exists uq_adsp_tenant_number
  on public.asset_disposals (tenant_id, disposal_number) where is_active = true;

alter table public.asset_audits drop constraint if exists aaud_tenant_number_key;
create unique index if not exists uq_aaud_tenant_number
  on public.asset_audits (tenant_id, audit_number) where is_active = true;

alter table public.asset_audit_items drop constraint if exists aaudi_audit_asset_key;
create unique index if not exists uq_aaudi_audit_asset
  on public.asset_audit_items (audit_id, asset_id) where is_active = true;

alter table public.maintenance_plans drop constraint if exists mplan_tenant_code_key;
create unique index if not exists uq_mplan_tenant_code
  on public.maintenance_plans (tenant_id, code) where is_active = true;

alter table public.maintenance_work_orders drop constraint if exists mwo_tenant_number_key;
create unique index if not exists uq_mwo_tenant_number
  on public.maintenance_work_orders (tenant_id, wo_number) where is_active = true;

alter table public.sla_policies drop constraint if exists sla_tenant_code_key;
create unique index if not exists uq_sla_tenant_code
  on public.sla_policies (tenant_id, code) where is_active = true;

alter table public.tickets drop constraint if exists tickets_tenant_number_key;
create unique index if not exists uq_tickets_tenant_number
  on public.tickets (tenant_id, ticket_number) where is_active = true;
