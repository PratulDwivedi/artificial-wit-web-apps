-- ============================================================================
-- PROCUREMENT + ASSET MANAGEMENT SYSTEM — Supabase / PostgreSQL
-- Schema-only migration (v1)
--
-- Modules:
--   01. Tenancy, Users, RBAC
--   02. Organization masters (departments, cost centers, locations)
--   03. Common masters (currency, uom, tax, category, condition, movement type,
--       vendors, items, number series, settings)
--   04. Workflow engine (configurable multi-level approvals, delegation)
--   05. Procurement (PR -> RFQ -> Quotation -> PO -> GRN -> Invoice -> Payment)
--   06. Inventory (warehouses, stock, stock ledger)
--   07. Assets (register, allocation/deallocation, transfer, depreciation,
--       warranty/AMC, disposal, physical audit)
--   08. Maintenance (plans, schedules, work orders, parts)
--   09. Ticketing (SLA, tickets, comments, activity)
--   10. Shared (attachments, notifications, audit log)
--   11. Indexes
--   12. Views (asset age, net book value)
--
-- Conventions (every tenant-scoped table carries these columns):
--   data jsonb            -> module-specific extension fields
--   metadata jsonb        -> UI / integration metadata
--   access_control jsonb  -> row-level ACL hints (roles/users/depts)
--   tenant_id integer     -> multitenancy (FK -> tenants)
--   is_active boolean default true
--   created_by / created_at / updated_by / updated_at -> audit
--   Business keys are unique per tenant: unique (tenant_id, code)
--   Statuses are text + CHECK constraints (easy to extend per tenant)
-- ============================================================================


-- ============================================================================
-- 01. TENANCY, USERS, RBAC
-- ============================================================================

create table public.tenants (
  id serial not null,
  code text not null,
  name text not null,
  legal_name text null,
  domain text null,
  logo_url text null,
  address text null,
  country text null,
  timezone text null default 'UTC',
  base_currency_code text null default 'USD',
  fiscal_year_start_month integer null default 4,          -- 1..12
  subscription_plan text null,
  subscription_valid_till date null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint tenants_pkey primary key (id),
  constraint tenants_code_key unique (code)
) tablespace pg_default;

create table public.users (
  id serial not null,
  auth_uid uuid null,                                       -- supabase auth.users.id
  employee_code text null,
  first_name text not null,
  last_name text null,
  email text not null,
  phone text null,
  avatar_url text null,
  department_id integer null,                               -- FK added post-create (circular)
  designation text null,
  reporting_to integer null,                                -- self FK: manager
  default_location_id integer null,
  is_tenant_admin boolean null default false,
  last_login_at timestamp without time zone null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint users_pkey primary key (id),
  constraint users_tenant_email_key unique (tenant_id, email),
  constraint users_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint users_reporting_to_fkey foreign key (reporting_to) references users (id)
) tablespace pg_default;

create table public.roles (
  id serial not null,
  code text not null,                                       -- e.g. ADMIN, PROCUREMENT_MANAGER, ASSET_MANAGER,
  name text not null,                                       --      STORE_KEEPER, FINANCE, TECHNICIAN, EMPLOYEE, AUDITOR
  descr text null,
  is_system boolean null default false,                     -- system roles cannot be deleted
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint roles_pkey primary key (id),
  constraint roles_tenant_code_key unique (tenant_id, code),
  constraint roles_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.permissions (
  id serial not null,
  code text not null,                                       -- e.g. pr.create, pr.approve, po.view, asset.transfer,
  name text not null,                                       --      asset.dispose, ticket.assign, wo.close
  module text not null,                                     -- procurement | asset | inventory | maintenance | ticket | admin
  action text not null,                                     -- create | read | update | delete | approve | assign | close | export
  descr text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer null,                                   -- null = global/seeded permission catalog
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint permissions_pkey primary key (id),
  constraint permissions_code_key unique (code)
) tablespace pg_default;

create table public.role_permissions (
  id serial not null,
  role_id integer not null,
  permission_id integer not null,
  scope text null default 'tenant',                         -- tenant | department | location | own
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint role_permissions_pkey primary key (id),
  constraint role_permissions_role_perm_key unique (tenant_id, role_id, permission_id),
  constraint role_permissions_role_fkey foreign key (role_id) references roles (id) on delete cascade,
  constraint role_permissions_permission_fkey foreign key (permission_id) references permissions (id) on delete cascade,
  constraint role_permissions_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.user_roles (
  id serial not null,
  user_id integer not null,
  role_id integer not null,
  location_id integer null,                                 -- optional: role limited to a location
  department_id integer null,                               -- optional: role limited to a department
  valid_from date null,
  valid_till date null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_role_key unique (tenant_id, user_id, role_id, location_id, department_id),
  constraint user_roles_user_fkey foreign key (user_id) references users (id) on delete cascade,
  constraint user_roles_role_fkey foreign key (role_id) references roles (id) on delete cascade,
  constraint user_roles_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 02. ORGANIZATION MASTERS
-- ============================================================================

create table public.departments (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  parent_id integer null,
  head_user_id integer null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint departments_pkey primary key (id),
  constraint departments_tenant_code_key unique (tenant_id, code),
  constraint departments_parent_fkey foreign key (parent_id) references departments (id),
  constraint departments_head_fkey foreign key (head_user_id) references users (id),
  constraint departments_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

alter table public.users
  add constraint users_department_fkey foreign key (department_id) references departments (id);

create table public.cost_centers (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  parent_id integer null,
  department_id integer null,
  owner_user_id integer null,
  budget_amount numeric(18, 4) null,
  budget_fy text null,                                      -- e.g. '2026-27'
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint cost_centers_pkey primary key (id),
  constraint cost_centers_tenant_code_key unique (tenant_id, code),
  constraint cost_centers_parent_fkey foreign key (parent_id) references cost_centers (id),
  constraint cost_centers_department_fkey foreign key (department_id) references departments (id),
  constraint cost_centers_owner_fkey foreign key (owner_user_id) references users (id),
  constraint cost_centers_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.locations (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  location_type text null default 'site',                   -- country | region | city | site | building | floor | room | rack
  parent_id integer null,
  address text null,
  city text null,
  state text null,
  country text null,
  postal_code text null,
  geo_location text null,                                   -- 'lat,lng'
  in_charge_user_id integer null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint locations_pkey primary key (id),
  constraint locations_tenant_code_key unique (tenant_id, code),
  constraint locations_parent_fkey foreign key (parent_id) references locations (id),
  constraint locations_incharge_fkey foreign key (in_charge_user_id) references users (id),
  constraint locations_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

alter table public.users
  add constraint users_default_location_fkey foreign key (default_location_id) references locations (id);


-- ============================================================================
-- 03. COMMON MASTERS
-- ============================================================================

create table public.currencies (
  id serial not null,
  code text not null,                                       -- ISO 4217: USD, INR, EUR
  name text not null,
  symbol text null,
  decimal_places integer null default 2,
  exchange_rate numeric(18, 6) null default 1,              -- vs tenant base currency
  rate_as_on date null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint currencies_pkey primary key (id),
  constraint currencies_tenant_code_key unique (tenant_id, code),
  constraint currencies_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.uoms (
  id serial not null,
  code text not null,                                       -- EA, BOX, KG, LTR, MTR, HR
  name text not null,
  uom_type text null,                                       -- quantity | weight | volume | length | time
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint uoms_pkey primary key (id),
  constraint uoms_tenant_code_key unique (tenant_id, code),
  constraint uoms_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.tax_codes (
  id serial not null,
  code text not null,                                       -- GST18, VAT5, EXEMPT
  name text not null,
  rate_percent numeric(9, 4) not null default 0,
  tax_type text null,                                       -- gst | vat | sales | withholding
  is_compound boolean null default false,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint tax_codes_pkey primary key (id),
  constraint tax_codes_tenant_code_key unique (tenant_id, code),
  constraint tax_codes_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.categories (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  category_type text not null default 'asset',              -- asset | item | ticket | maintenance
  parent_id integer null,
  -- asset-category defaults (inherited by assets on creation):
  default_useful_life_months integer null,
  default_depreciation_method_id integer null,              -- FK added after depreciation_methods
  default_salvage_percent numeric(9, 4) null,
  icon text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint categories_pkey primary key (id),
  constraint categories_tenant_type_code_key unique (tenant_id, category_type, code),
  constraint categories_parent_fkey foreign key (parent_id) references categories (id),
  constraint categories_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.conditions (
  id serial not null,
  code text not null,                                       -- NEW, GOOD, FAIR, POOR, DAMAGED, SCRAP
  name text not null,
  descr text null,
  rank integer null,                                        -- ordering best -> worst
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint conditions_pkey primary key (id),
  constraint conditions_tenant_code_key unique (tenant_id, code),
  constraint conditions_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.movement_types (
  id serial not null,
  code text not null,                                       -- ALLOCATE, DEALLOCATE, TRANSFER, RETURN, REPAIR_OUT,
  name text not null,                                       -- REPAIR_IN, LOAN, DISPOSE
  direction text null,                                      -- out | in | internal
  requires_approval boolean null default false,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint movement_types_pkey primary key (id),
  constraint movement_types_tenant_code_key unique (tenant_id, code),
  constraint movement_types_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.vendors (
  id serial not null,
  code text not null,
  name text not null,
  legal_name text null,
  vendor_type text null,                                    -- supplier | service_provider | manufacturer | contractor
  email text null,
  phone text null,
  website text null,
  address text null,
  city text null,
  state text null,
  country text null,
  postal_code text null,
  tax_registration_no text null,                            -- GSTIN / VAT no
  pan_no text null,
  bank_name text null,
  bank_account_no text null,
  bank_ifsc text null,
  currency_id integer null,
  payment_terms text null,                                  -- e.g. 'NET30'
  credit_limit numeric(18, 4) null,
  rating numeric(3, 2) null,                                -- 0.00 - 5.00
  is_blacklisted boolean null default false,
  blacklist_reason text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint vendors_pkey primary key (id),
  constraint vendors_tenant_code_key unique (tenant_id, code),
  constraint vendors_currency_fkey foreign key (currency_id) references currencies (id),
  constraint vendors_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.vendor_contacts (
  id serial not null,
  vendor_id integer not null,
  name text not null,
  designation text null,
  email text null,
  phone text null,
  is_primary boolean null default false,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint vendor_contacts_pkey primary key (id),
  constraint vendor_contacts_vendor_fkey foreign key (vendor_id) references vendors (id) on delete cascade,
  constraint vendor_contacts_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.items (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  item_type text not null default 'stock',                  -- stock | asset | consumable | service | spare_part
  category_id integer null,
  uom_id integer null,
  brand text null,
  model text null,
  manufacturer text null,
  hsn_sac_code text null,
  tax_code_id integer null,
  standard_cost numeric(18, 4) null,
  last_purchase_price numeric(18, 4) null,
  min_stock_level numeric(18, 4) null,
  max_stock_level numeric(18, 4) null,
  reorder_level numeric(18, 4) null,
  reorder_qty numeric(18, 4) null,
  lead_time_days integer null,
  preferred_vendor_id integer null,
  is_asset_item boolean null default false,                 -- GRN of this item creates asset records
  barcode text null,
  image_url text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint items_pkey primary key (id),
  constraint items_tenant_code_key unique (tenant_id, code),
  constraint items_category_fkey foreign key (category_id) references categories (id),
  constraint items_uom_fkey foreign key (uom_id) references uoms (id),
  constraint items_tax_fkey foreign key (tax_code_id) references tax_codes (id),
  constraint items_pref_vendor_fkey foreign key (preferred_vendor_id) references vendors (id),
  constraint items_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint items_type_check check (item_type in ('stock','asset','consumable','service','spare_part'))
) tablespace pg_default;

create table public.number_series (
  id serial not null,
  doc_type text not null,                                   -- PR | RFQ | QUO | PO | GRN | INV | PAY | AST | TRF | WO | TKT | DSP | AUD
  prefix text null,                                         -- e.g. 'PO/{FY}/'
  fiscal_year text null,                                    -- null = continuous series
  next_number integer not null default 1,
  padding integer null default 5,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint number_series_pkey primary key (id),
  constraint number_series_tenant_doc_fy_key unique (tenant_id, doc_type, fiscal_year),
  constraint number_series_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.app_settings (
  id serial not null,
  setting_key text not null,                                -- e.g. 'asset.auto_capitalize_on_grn', 'ticket.default_sla_id'
  setting_value jsonb null,
  descr text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint app_settings_pkey primary key (id),
  constraint app_settings_tenant_key_key unique (tenant_id, setting_key),
  constraint app_settings_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 04. WORKFLOW ENGINE (configurable approvals for any document)
--     entity_type values used across the system:
--     'purchase_requisition' | 'purchase_order' | 'goods_receipt' |
--     'purchase_invoice' | 'asset_transfer' | 'asset_disposal' |
--     'maintenance_work_order' | 'ticket'
-- ============================================================================

create table public.workflow_definitions (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  entity_type text not null,
  trigger_condition jsonb null,                             -- e.g. {"min_amount":0,"max_amount":100000,"department_ids":[1,2]}
  version integer not null default 1,
  is_default boolean null default false,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint workflow_definitions_pkey primary key (id),
  constraint workflow_definitions_tenant_code_ver_key unique (tenant_id, code, version),
  constraint workflow_definitions_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.workflow_steps (
  id serial not null,
  workflow_definition_id integer not null,
  step_no integer not null,                                 -- 1..n execution order
  name text not null,                                       -- e.g. 'Department Head Approval'
  approver_type text not null default 'role',               -- role | user | reporting_manager | department_head |
                                                            -- cost_center_owner | dynamic (resolved via rule jsonb)
  approver_role_id integer null,
  approver_user_id integer null,
  approver_rule jsonb null,                                 -- for dynamic resolution
  min_approvers integer null default 1,                     -- for parallel approval
  is_parallel boolean null default false,
  condition jsonb null,                                     -- step skipped unless condition matches (e.g. amount > x)
  sla_hours integer null,                                   -- escalate if pending beyond this
  escalate_to_role_id integer null,
  escalate_to_user_id integer null,
  allow_delegate boolean null default true,
  allow_return boolean null default true,                   -- return to initiator for rework
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint workflow_steps_pkey primary key (id),
  constraint workflow_steps_def_step_key unique (workflow_definition_id, step_no),
  constraint workflow_steps_def_fkey foreign key (workflow_definition_id) references workflow_definitions (id) on delete cascade,
  constraint workflow_steps_role_fkey foreign key (approver_role_id) references roles (id),
  constraint workflow_steps_user_fkey foreign key (approver_user_id) references users (id),
  constraint workflow_steps_esc_role_fkey foreign key (escalate_to_role_id) references roles (id),
  constraint workflow_steps_esc_user_fkey foreign key (escalate_to_user_id) references users (id),
  constraint workflow_steps_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.workflow_instances (
  id serial not null,
  workflow_definition_id integer not null,
  entity_type text not null,
  entity_id integer not null,
  current_step_no integer null,
  status text not null default 'in_progress',               -- in_progress | approved | rejected | returned | cancelled
  initiated_by integer null,
  initiated_at timestamp without time zone null default now(),
  completed_at timestamp without time zone null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint workflow_instances_pkey primary key (id),
  constraint workflow_instances_def_fkey foreign key (workflow_definition_id) references workflow_definitions (id),
  constraint workflow_instances_initiator_fkey foreign key (initiated_by) references users (id),
  constraint workflow_instances_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint workflow_instances_status_check check (status in ('in_progress','approved','rejected','returned','cancelled'))
) tablespace pg_default;

create table public.workflow_actions (
  id serial not null,
  workflow_instance_id integer not null,
  workflow_step_id integer null,
  step_no integer null,
  action text not null,                                     -- submitted | approved | rejected | returned | delegated |
                                                            -- escalated | cancelled | commented
  action_by integer not null,
  acted_on_behalf_of integer null,                          -- when delegated
  comments text null,
  acted_at timestamp without time zone null default now(),
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint workflow_actions_pkey primary key (id),
  constraint workflow_actions_instance_fkey foreign key (workflow_instance_id) references workflow_instances (id) on delete cascade,
  constraint workflow_actions_step_fkey foreign key (workflow_step_id) references workflow_steps (id),
  constraint workflow_actions_actor_fkey foreign key (action_by) references users (id),
  constraint workflow_actions_behalf_fkey foreign key (acted_on_behalf_of) references users (id),
  constraint workflow_actions_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.approval_delegations (
  id serial not null,
  from_user_id integer not null,
  to_user_id integer not null,
  entity_type text null,                                    -- null = all document types
  from_date date not null,
  to_date date not null,
  reason text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint approval_delegations_pkey primary key (id),
  constraint approval_delegations_from_fkey foreign key (from_user_id) references users (id),
  constraint approval_delegations_to_fkey foreign key (to_user_id) references users (id),
  constraint approval_delegations_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 05. PROCUREMENT
-- ============================================================================

create table public.purchase_requisitions (
  id serial not null,
  pr_number text not null,
  title text null,
  descr text null,
  requisition_type text null default 'purchase',            -- purchase | service | asset | replenishment
  requested_by integer not null,
  department_id integer null,
  cost_center_id integer null,
  deliver_to_location_id integer null,
  required_by_date date null,
  priority text null default 'medium',                      -- low | medium | high | urgent
  currency_id integer null,
  estimated_total numeric(18, 4) null,
  budget_available numeric(18, 4) null,
  status text not null default 'draft',                     -- draft | submitted | in_approval | approved | rejected |
                                                            -- returned | partially_ordered | ordered | cancelled | closed
  workflow_instance_id integer null,
  submitted_at timestamp without time zone null,
  approved_at timestamp without time zone null,
  rejection_reason text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint purchase_requisitions_pkey primary key (id),
  constraint pr_tenant_number_key unique (tenant_id, pr_number),
  constraint pr_requested_by_fkey foreign key (requested_by) references users (id),
  constraint pr_department_fkey foreign key (department_id) references departments (id),
  constraint pr_cost_center_fkey foreign key (cost_center_id) references cost_centers (id),
  constraint pr_location_fkey foreign key (deliver_to_location_id) references locations (id),
  constraint pr_currency_fkey foreign key (currency_id) references currencies (id),
  constraint pr_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint pr_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint pr_status_check check (status in ('draft','submitted','in_approval','approved','rejected','returned','partially_ordered','ordered','cancelled','closed')),
  constraint pr_priority_check check (priority in ('low','medium','high','urgent'))
) tablespace pg_default;

create table public.purchase_requisition_items (
  id serial not null,
  pr_id integer not null,
  line_no integer null,
  item_id integer null,                                     -- null = free-text/new item
  item_descr text null,
  category_id integer null,
  uom_id integer null,
  quantity numeric(18, 4) not null,
  estimated_unit_price numeric(18, 4) null,
  estimated_amount numeric(18, 4) null,
  required_by_date date null,
  cost_center_id integer null,                              -- line-level override
  suggested_vendor_id integer null,
  ordered_qty numeric(18, 4) null default 0,                -- fulfilled via PO
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint pr_items_pkey primary key (id),
  constraint pr_items_pr_fkey foreign key (pr_id) references purchase_requisitions (id) on delete cascade,
  constraint pr_items_item_fkey foreign key (item_id) references items (id),
  constraint pr_items_category_fkey foreign key (category_id) references categories (id),
  constraint pr_items_uom_fkey foreign key (uom_id) references uoms (id),
  constraint pr_items_cc_fkey foreign key (cost_center_id) references cost_centers (id),
  constraint pr_items_vendor_fkey foreign key (suggested_vendor_id) references vendors (id),
  constraint pr_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.rfqs (
  id serial not null,
  rfq_number text not null,
  title text null,
  descr text null,
  pr_id integer null,
  issue_date date null,
  due_date date null,                                       -- quotation submission deadline
  status text not null default 'draft',                     -- draft | issued | quoted | evaluated | awarded | cancelled | closed
  terms_and_conditions text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint rfqs_pkey primary key (id),
  constraint rfqs_tenant_number_key unique (tenant_id, rfq_number),
  constraint rfqs_pr_fkey foreign key (pr_id) references purchase_requisitions (id),
  constraint rfqs_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint rfqs_status_check check (status in ('draft','issued','quoted','evaluated','awarded','cancelled','closed'))
) tablespace pg_default;

create table public.rfq_items (
  id serial not null,
  rfq_id integer not null,
  pr_item_id integer null,
  item_id integer null,
  item_descr text null,
  uom_id integer null,
  quantity numeric(18, 4) not null,
  specifications text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint rfq_items_pkey primary key (id),
  constraint rfq_items_rfq_fkey foreign key (rfq_id) references rfqs (id) on delete cascade,
  constraint rfq_items_pr_item_fkey foreign key (pr_item_id) references purchase_requisition_items (id),
  constraint rfq_items_item_fkey foreign key (item_id) references items (id),
  constraint rfq_items_uom_fkey foreign key (uom_id) references uoms (id),
  constraint rfq_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.rfq_vendors (
  id serial not null,
  rfq_id integer not null,
  vendor_id integer not null,
  invited_at timestamp without time zone null default now(),
  responded_at timestamp without time zone null,
  response_status text null default 'pending',              -- pending | quoted | declined | no_response
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint rfq_vendors_pkey primary key (id),
  constraint rfq_vendors_rfq_vendor_key unique (rfq_id, vendor_id),
  constraint rfq_vendors_rfq_fkey foreign key (rfq_id) references rfqs (id) on delete cascade,
  constraint rfq_vendors_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint rfq_vendors_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.vendor_quotations (
  id serial not null,
  quotation_number text not null,
  rfq_id integer null,
  vendor_id integer not null,
  quotation_date date null,
  valid_till date null,
  currency_id integer null,
  payment_terms text null,
  delivery_terms text null,
  delivery_days integer null,
  subtotal numeric(18, 4) null,
  tax_amount numeric(18, 4) null,
  discount_amount numeric(18, 4) null,
  total_amount numeric(18, 4) null,
  status text not null default 'received',                  -- received | under_evaluation | shortlisted | awarded | rejected
  evaluation_score numeric(9, 4) null,
  evaluation_notes text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint vendor_quotations_pkey primary key (id),
  constraint vq_tenant_number_key unique (tenant_id, quotation_number),
  constraint vq_rfq_fkey foreign key (rfq_id) references rfqs (id),
  constraint vq_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint vq_currency_fkey foreign key (currency_id) references currencies (id),
  constraint vq_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint vq_status_check check (status in ('received','under_evaluation','shortlisted','awarded','rejected'))
) tablespace pg_default;

create table public.vendor_quotation_items (
  id serial not null,
  quotation_id integer not null,
  rfq_item_id integer null,
  item_id integer null,
  item_descr text null,
  uom_id integer null,
  quantity numeric(18, 4) not null,
  unit_price numeric(18, 4) not null,
  discount_percent numeric(9, 4) null default 0,
  tax_code_id integer null,
  line_total numeric(18, 4) null,
  delivery_days integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint vq_items_pkey primary key (id),
  constraint vq_items_quotation_fkey foreign key (quotation_id) references vendor_quotations (id) on delete cascade,
  constraint vq_items_rfq_item_fkey foreign key (rfq_item_id) references rfq_items (id),
  constraint vq_items_item_fkey foreign key (item_id) references items (id),
  constraint vq_items_uom_fkey foreign key (uom_id) references uoms (id),
  constraint vq_items_tax_fkey foreign key (tax_code_id) references tax_codes (id),
  constraint vq_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.purchase_orders (
  id serial not null,
  po_number text not null,
  po_date date not null default current_date,
  po_type text null default 'standard',                     -- standard | blanket | service | asset
  vendor_id integer not null,
  pr_id integer null,
  rfq_id integer null,
  quotation_id integer null,
  currency_id integer null,
  exchange_rate numeric(18, 6) null default 1,
  payment_terms text null,
  delivery_terms text null,                                 -- incoterms etc.
  ship_to_location_id integer null,
  bill_to_location_id integer null,
  cost_center_id integer null,
  expected_delivery_date date null,
  subtotal numeric(18, 4) null,
  discount_amount numeric(18, 4) null,
  tax_amount numeric(18, 4) null,
  freight_amount numeric(18, 4) null,
  other_charges numeric(18, 4) null,
  total_amount numeric(18, 4) null,
  status text not null default 'draft',                     -- draft | submitted | in_approval | approved | rejected |
                                                            -- sent_to_vendor | acknowledged | partially_received |
                                                            -- received | invoiced | cancelled | closed
  workflow_instance_id integer null,
  approved_at timestamp without time zone null,
  sent_at timestamp without time zone null,
  acknowledged_at timestamp without time zone null,
  terms_and_conditions text null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint purchase_orders_pkey primary key (id),
  constraint po_tenant_number_key unique (tenant_id, po_number),
  constraint po_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint po_pr_fkey foreign key (pr_id) references purchase_requisitions (id),
  constraint po_rfq_fkey foreign key (rfq_id) references rfqs (id),
  constraint po_quotation_fkey foreign key (quotation_id) references vendor_quotations (id),
  constraint po_currency_fkey foreign key (currency_id) references currencies (id),
  constraint po_ship_to_fkey foreign key (ship_to_location_id) references locations (id),
  constraint po_bill_to_fkey foreign key (bill_to_location_id) references locations (id),
  constraint po_cc_fkey foreign key (cost_center_id) references cost_centers (id),
  constraint po_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint po_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint po_status_check check (status in ('draft','submitted','in_approval','approved','rejected','sent_to_vendor','acknowledged','partially_received','received','invoiced','cancelled','closed'))
) tablespace pg_default;

create table public.purchase_order_items (
  id serial not null,
  po_id integer not null,
  line_no integer null,
  pr_item_id integer null,
  quotation_item_id integer null,
  item_id integer null,
  item_descr text null,
  uom_id integer null,
  quantity numeric(18, 4) not null,
  unit_price numeric(18, 4) not null,
  discount_percent numeric(9, 4) null default 0,
  discount_amount numeric(18, 4) null default 0,
  tax_code_id integer null,
  tax_amount numeric(18, 4) null default 0,
  line_total numeric(18, 4) null,
  received_qty numeric(18, 4) null default 0,
  invoiced_qty numeric(18, 4) null default 0,
  cancelled_qty numeric(18, 4) null default 0,
  expected_delivery_date date null,
  cost_center_id integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint po_items_pkey primary key (id),
  constraint po_items_po_fkey foreign key (po_id) references purchase_orders (id) on delete cascade,
  constraint po_items_pr_item_fkey foreign key (pr_item_id) references purchase_requisition_items (id),
  constraint po_items_vq_item_fkey foreign key (quotation_item_id) references vendor_quotation_items (id),
  constraint po_items_item_fkey foreign key (item_id) references items (id),
  constraint po_items_uom_fkey foreign key (uom_id) references uoms (id),
  constraint po_items_tax_fkey foreign key (tax_code_id) references tax_codes (id),
  constraint po_items_cc_fkey foreign key (cost_center_id) references cost_centers (id),
  constraint po_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.goods_receipts (
  id serial not null,
  grn_number text not null,
  po_id integer not null,
  vendor_id integer null,
  receipt_date date not null default current_date,
  received_by integer null,
  warehouse_id integer null,                                -- FK added after warehouses
  vendor_challan_no text null,
  vendor_challan_date date null,
  vehicle_no text null,
  status text not null default 'draft',                     -- draft | submitted | inspected | accepted |
                                                            -- partially_accepted | rejected | cancelled
  inspection_by integer null,
  inspection_date date null,
  inspection_notes text null,
  workflow_instance_id integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint goods_receipts_pkey primary key (id),
  constraint grn_tenant_number_key unique (tenant_id, grn_number),
  constraint grn_po_fkey foreign key (po_id) references purchase_orders (id),
  constraint grn_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint grn_received_by_fkey foreign key (received_by) references users (id),
  constraint grn_inspection_by_fkey foreign key (inspection_by) references users (id),
  constraint grn_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint grn_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint grn_status_check check (status in ('draft','submitted','inspected','accepted','partially_accepted','rejected','cancelled'))
) tablespace pg_default;

create table public.goods_receipt_items (
  id serial not null,
  grn_id integer not null,
  po_item_id integer not null,
  item_id integer null,
  ordered_qty numeric(18, 4) null,
  received_qty numeric(18, 4) not null,
  accepted_qty numeric(18, 4) null default 0,
  rejected_qty numeric(18, 4) null default 0,
  rejection_reason text null,
  unit_price numeric(18, 4) null,
  batch_no text null,
  serial_numbers jsonb null,                                -- ["SN001","SN002"] for asset items
  assets_created boolean null default false,                -- asset rows generated from this line
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint grn_items_pkey primary key (id),
  constraint grn_items_grn_fkey foreign key (grn_id) references goods_receipts (id) on delete cascade,
  constraint grn_items_po_item_fkey foreign key (po_item_id) references purchase_order_items (id),
  constraint grn_items_item_fkey foreign key (item_id) references items (id),
  constraint grn_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.purchase_invoices (
  id serial not null,
  invoice_number text not null,                             -- internal number
  vendor_invoice_no text null,
  vendor_invoice_date date null,
  po_id integer null,
  grn_id integer null,
  vendor_id integer not null,
  currency_id integer null,
  exchange_rate numeric(18, 6) null default 1,
  invoice_date date not null default current_date,
  due_date date null,
  subtotal numeric(18, 4) null,
  discount_amount numeric(18, 4) null,
  tax_amount numeric(18, 4) null,
  freight_amount numeric(18, 4) null,
  total_amount numeric(18, 4) null,
  paid_amount numeric(18, 4) null default 0,
  status text not null default 'draft',                     -- draft | submitted | in_approval | approved | rejected |
                                                            -- partially_paid | paid | cancelled
  workflow_instance_id integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint purchase_invoices_pkey primary key (id),
  constraint pinv_tenant_number_key unique (tenant_id, invoice_number),
  constraint pinv_po_fkey foreign key (po_id) references purchase_orders (id),
  constraint pinv_grn_fkey foreign key (grn_id) references goods_receipts (id),
  constraint pinv_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint pinv_currency_fkey foreign key (currency_id) references currencies (id),
  constraint pinv_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint pinv_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint pinv_status_check check (status in ('draft','submitted','in_approval','approved','rejected','partially_paid','paid','cancelled'))
) tablespace pg_default;

create table public.purchase_invoice_items (
  id serial not null,
  invoice_id integer not null,
  po_item_id integer null,
  grn_item_id integer null,
  item_id integer null,
  item_descr text null,
  quantity numeric(18, 4) not null,
  unit_price numeric(18, 4) not null,
  discount_amount numeric(18, 4) null default 0,
  tax_code_id integer null,
  tax_amount numeric(18, 4) null default 0,
  line_total numeric(18, 4) null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint pinv_items_pkey primary key (id),
  constraint pinv_items_invoice_fkey foreign key (invoice_id) references purchase_invoices (id) on delete cascade,
  constraint pinv_items_po_item_fkey foreign key (po_item_id) references purchase_order_items (id),
  constraint pinv_items_grn_item_fkey foreign key (grn_item_id) references goods_receipt_items (id),
  constraint pinv_items_item_fkey foreign key (item_id) references items (id),
  constraint pinv_items_tax_fkey foreign key (tax_code_id) references tax_codes (id),
  constraint pinv_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.vendor_payments (
  id serial not null,
  payment_number text not null,
  vendor_id integer not null,
  invoice_id integer null,
  payment_date date not null default current_date,
  payment_mode text null,                                   -- bank_transfer | cheque | cash | card | upi
  reference_no text null,                                   -- UTR / cheque no
  currency_id integer null,
  amount numeric(18, 4) not null,
  tds_amount numeric(18, 4) null default 0,
  status text not null default 'draft',                     -- draft | approved | processed | failed | cancelled
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint vendor_payments_pkey primary key (id),
  constraint vpay_tenant_number_key unique (tenant_id, payment_number),
  constraint vpay_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint vpay_invoice_fkey foreign key (invoice_id) references purchase_invoices (id),
  constraint vpay_currency_fkey foreign key (currency_id) references currencies (id),
  constraint vpay_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 06. INVENTORY
-- ============================================================================

create table public.warehouses (
  id serial not null,
  code text not null,
  name text not null,
  location_id integer null,
  warehouse_type text null default 'main',                  -- main | store | scrap | repair | transit
  in_charge_user_id integer null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint warehouses_pkey primary key (id),
  constraint warehouses_tenant_code_key unique (tenant_id, code),
  constraint warehouses_location_fkey foreign key (location_id) references locations (id),
  constraint warehouses_incharge_fkey foreign key (in_charge_user_id) references users (id),
  constraint warehouses_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

alter table public.goods_receipts
  add constraint grn_warehouse_fkey foreign key (warehouse_id) references warehouses (id);

create table public.item_stocks (
  id serial not null,
  item_id integer not null,
  warehouse_id integer not null,
  qty_on_hand numeric(18, 4) not null default 0,
  qty_reserved numeric(18, 4) not null default 0,
  qty_in_transit numeric(18, 4) not null default 0,
  avg_unit_cost numeric(18, 4) null,
  last_txn_at timestamp without time zone null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint item_stocks_pkey primary key (id),
  constraint item_stocks_item_wh_key unique (tenant_id, item_id, warehouse_id),
  constraint item_stocks_item_fkey foreign key (item_id) references items (id),
  constraint item_stocks_wh_fkey foreign key (warehouse_id) references warehouses (id),
  constraint item_stocks_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.stock_transactions (
  id serial not null,
  txn_number text null,
  item_id integer not null,
  warehouse_id integer not null,
  txn_type text not null,                                   -- grn_in | issue_out | transfer_in | transfer_out |
                                                            -- adjustment_in | adjustment_out | return_in |
                                                            -- maintenance_issue | disposal_out
  txn_date timestamp without time zone not null default now(),
  quantity numeric(18, 4) not null,                         -- always positive; direction from txn_type
  unit_cost numeric(18, 4) null,
  ref_entity_type text null,                                -- goods_receipt | maintenance_work_order | asset_disposal | ...
  ref_entity_id integer null,
  batch_no text null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint stock_transactions_pkey primary key (id),
  constraint stock_txn_item_fkey foreign key (item_id) references items (id),
  constraint stock_txn_wh_fkey foreign key (warehouse_id) references warehouses (id),
  constraint stock_txn_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 07. ASSETS
-- ============================================================================

create table public.depreciation_methods (
  id serial not null,
  code text not null,                                       -- SLM | WDV | DDB | UOP | NONE
  name text not null,                                       -- straight line, written down value, double declining, units of production
  method_type text not null default 'straight_line',        -- straight_line | declining_balance | double_declining |
                                                            -- units_of_production | none
  default_rate_percent numeric(9, 4) null,                  -- annual rate for declining methods
  descr text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint depreciation_methods_pkey primary key (id),
  constraint dep_methods_tenant_code_key unique (tenant_id, code),
  constraint dep_methods_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

alter table public.categories
  add constraint categories_dep_method_fkey
  foreign key (default_depreciation_method_id) references depreciation_methods (id);

create table public.assets (
  id serial not null,
  code text null,                                           -- asset tag, unique per tenant
  name text null,
  descr text null,
  category_id integer not null,
  location_id integer not null,
  condition_id integer null,
  cost_center_id integer null,
  department_id integer null,
  vendor_id integer null,
  manufacturer text null,
  brand text null,
  model text null,
  serial_no text null,
  barcode text null,
  qr_code text null,
  parent_id integer null,                                   -- component-of hierarchy
  item_id integer null,                                     -- catalog item this asset was created from
  asset_image text null,
  geo_location text null,
  reference_id text null,
  -- procurement linkage
  po_number text null,
  po_id integer null,
  grn_item_id integer null,
  invoice_id integer null,
  -- financials
  purchase_date date null,
  purchase_price numeric(18, 4) null,
  capitalization_date date null,
  capitalization_price numeric(18, 4) null,
  current_value numeric(18, 4) null,                        -- net book value (maintained by depreciation posting)
  salvage_value numeric(18, 4) null default 0,
  discard_value numeric(18, 4) null,
  -- depreciation config
  depreciation_method_id integer null,
  useful_life_months integer null,
  depreciation_rate_percent numeric(9, 4) null,             -- for WDV/DDB
  total_expected_units numeric(18, 4) null,                 -- for units-of-production
  depreciation_start_date date null,
  last_depreciation_date date null,
  accumulated_depreciation numeric(18, 4) null default 0,
  is_fully_depreciated boolean null default false,
  -- lifecycle
  end_of_life date null,
  warranty_expiry_date date null,
  amc_expiry_date date null,
  status text not null default 'in_stock',                  -- draft | in_stock | allocated | in_transfer | under_repair |
                                                            -- under_maintenance | idle | lost | disposed | scrapped
  -- current custody (denormalized snapshot; history in asset_movements)
  movement_type_id integer null,
  allocated_to_user_id integer null,
  allocated_at timestamp without time zone null,
  movement_upto_date date null,
  custodian_remarks text null,
  is_submitted boolean null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint assets_pkey primary key (id),
  constraint assets_tenant_code_key unique (tenant_id, code),
  constraint assets_category_fkey foreign key (category_id) references categories (id),
  constraint assets_location_fkey foreign key (location_id) references locations (id),
  constraint assets_condition_fkey foreign key (condition_id) references conditions (id),
  constraint assets_cc_fkey foreign key (cost_center_id) references cost_centers (id),
  constraint assets_department_fkey foreign key (department_id) references departments (id),
  constraint assets_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint assets_parent_fkey foreign key (parent_id) references assets (id),
  constraint assets_item_fkey foreign key (item_id) references items (id),
  constraint assets_po_fkey foreign key (po_id) references purchase_orders (id),
  constraint assets_grn_item_fkey foreign key (grn_item_id) references goods_receipt_items (id),
  constraint assets_invoice_fkey foreign key (invoice_id) references purchase_invoices (id),
  constraint assets_dep_method_fkey foreign key (depreciation_method_id) references depreciation_methods (id),
  constraint assets_movement_type_fkey foreign key (movement_type_id) references movement_types (id),
  constraint assets_allocated_user_fkey foreign key (allocated_to_user_id) references users (id),
  constraint assets_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint assets_status_check check (status in ('draft','in_stock','allocated','in_transfer','under_repair','under_maintenance','idle','lost','disposed','scrapped'))
) tablespace pg_default;

create table public.asset_movements (
  id serial not null,
  asset_id integer not null,
  movement_type_id integer not null,                        -- ALLOCATE / DEALLOCATE / TRANSFER / RETURN / REPAIR_OUT ...
  movement_date timestamp without time zone not null default now(),
  from_user_id integer null,
  to_user_id integer null,
  from_location_id integer null,
  to_location_id integer null,
  from_department_id integer null,
  to_department_id integer null,
  from_cost_center_id integer null,
  to_cost_center_id integer null,
  expected_return_date date null,                           -- for loans / temporary allocation
  actual_return_date date null,
  condition_at_movement_id integer null,
  transfer_id integer null,                                 -- FK added after asset_transfers
  ticket_id integer null,                                   -- FK added after tickets
  work_order_id integer null,                               -- FK added after maintenance_work_orders
  acknowledged_by integer null,                             -- receiver acknowledgment
  acknowledged_at timestamp without time zone null,
  status text not null default 'completed',                 -- pending | in_transit | completed | cancelled
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_movements_pkey primary key (id),
  constraint amov_asset_fkey foreign key (asset_id) references assets (id),
  constraint amov_type_fkey foreign key (movement_type_id) references movement_types (id),
  constraint amov_from_user_fkey foreign key (from_user_id) references users (id),
  constraint amov_to_user_fkey foreign key (to_user_id) references users (id),
  constraint amov_from_loc_fkey foreign key (from_location_id) references locations (id),
  constraint amov_to_loc_fkey foreign key (to_location_id) references locations (id),
  constraint amov_from_dept_fkey foreign key (from_department_id) references departments (id),
  constraint amov_to_dept_fkey foreign key (to_department_id) references departments (id),
  constraint amov_from_cc_fkey foreign key (from_cost_center_id) references cost_centers (id),
  constraint amov_to_cc_fkey foreign key (to_cost_center_id) references cost_centers (id),
  constraint amov_condition_fkey foreign key (condition_at_movement_id) references conditions (id),
  constraint amov_ack_by_fkey foreign key (acknowledged_by) references users (id),
  constraint amov_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint amov_status_check check (status in ('pending','in_transit','completed','cancelled'))
) tablespace pg_default;

create table public.asset_transfers (
  id serial not null,
  transfer_number text not null,
  transfer_type text null default 'location',               -- location | user | department | cost_center | inter_site
  from_location_id integer null,
  to_location_id integer null,
  from_user_id integer null,
  to_user_id integer null,
  from_department_id integer null,
  to_department_id integer null,
  requested_by integer not null,
  transfer_date date null,
  expected_receipt_date date null,
  reason text null,
  status text not null default 'draft',                     -- draft | submitted | in_approval | approved | rejected |
                                                            -- in_transit | received | cancelled
  workflow_instance_id integer null,
  dispatched_at timestamp without time zone null,
  received_at timestamp without time zone null,
  received_by integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_transfers_pkey primary key (id),
  constraint atrf_tenant_number_key unique (tenant_id, transfer_number),
  constraint atrf_from_loc_fkey foreign key (from_location_id) references locations (id),
  constraint atrf_to_loc_fkey foreign key (to_location_id) references locations (id),
  constraint atrf_from_user_fkey foreign key (from_user_id) references users (id),
  constraint atrf_to_user_fkey foreign key (to_user_id) references users (id),
  constraint atrf_from_dept_fkey foreign key (from_department_id) references departments (id),
  constraint atrf_to_dept_fkey foreign key (to_department_id) references departments (id),
  constraint atrf_requested_by_fkey foreign key (requested_by) references users (id),
  constraint atrf_received_by_fkey foreign key (received_by) references users (id),
  constraint atrf_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint atrf_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint atrf_status_check check (status in ('draft','submitted','in_approval','approved','rejected','in_transit','received','cancelled'))
) tablespace pg_default;

alter table public.asset_movements
  add constraint amov_transfer_fkey foreign key (transfer_id) references asset_transfers (id);

create table public.asset_transfer_items (
  id serial not null,
  transfer_id integer not null,
  asset_id integer not null,
  condition_at_dispatch_id integer null,
  condition_at_receipt_id integer null,
  received boolean null default false,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_transfer_items_pkey primary key (id),
  constraint atrf_items_transfer_asset_key unique (transfer_id, asset_id),
  constraint atrf_items_transfer_fkey foreign key (transfer_id) references asset_transfers (id) on delete cascade,
  constraint atrf_items_asset_fkey foreign key (asset_id) references assets (id),
  constraint atrf_items_cond_dispatch_fkey foreign key (condition_at_dispatch_id) references conditions (id),
  constraint atrf_items_cond_receipt_fkey foreign key (condition_at_receipt_id) references conditions (id),
  constraint atrf_items_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.asset_depreciation_schedules (
  id serial not null,
  asset_id integer not null,
  fiscal_year text not null,                                -- '2026-27'
  period_no integer not null,                               -- 1..12 (monthly) or 1..4 (quarterly)
  period_start date not null,
  period_end date not null,
  opening_value numeric(18, 4) null,
  planned_depreciation numeric(18, 4) null,
  closing_value numeric(18, 4) null,
  is_posted boolean null default false,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_dep_schedules_pkey primary key (id),
  constraint adsch_asset_period_key unique (asset_id, fiscal_year, period_no),
  constraint adsch_asset_fkey foreign key (asset_id) references assets (id) on delete cascade,
  constraint adsch_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.asset_depreciation_entries (
  id serial not null,
  asset_id integer not null,
  schedule_id integer null,
  depreciation_method_id integer null,
  fiscal_year text null,
  period_no integer null,
  depreciation_date date not null,
  opening_value numeric(18, 4) not null,
  depreciation_amount numeric(18, 4) not null,
  closing_value numeric(18, 4) not null,
  accumulated_depreciation numeric(18, 4) null,
  units_consumed numeric(18, 4) null,                       -- for units-of-production
  is_reversal boolean null default false,
  reversed_entry_id integer null,
  posted_by integer null,
  posted_at timestamp without time zone null default now(),
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_dep_entries_pkey primary key (id),
  constraint adent_asset_fkey foreign key (asset_id) references assets (id),
  constraint adent_schedule_fkey foreign key (schedule_id) references asset_depreciation_schedules (id),
  constraint adent_method_fkey foreign key (depreciation_method_id) references depreciation_methods (id),
  constraint adent_reversed_fkey foreign key (reversed_entry_id) references asset_depreciation_entries (id),
  constraint adent_posted_by_fkey foreign key (posted_by) references users (id),
  constraint adent_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.asset_warranties (
  id serial not null,
  asset_id integer not null,
  warranty_type text null default 'manufacturer',           -- manufacturer | extended | amc | insurance
  provider_vendor_id integer null,
  contract_no text null,
  start_date date not null,
  end_date date not null,
  coverage text null,                                       -- what is covered
  cost numeric(18, 4) null,
  renewal_reminder_days integer null default 30,
  contact_name text null,
  contact_phone text null,
  contact_email text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_warranties_pkey primary key (id),
  constraint awar_asset_fkey foreign key (asset_id) references assets (id) on delete cascade,
  constraint awar_vendor_fkey foreign key (provider_vendor_id) references vendors (id),
  constraint awar_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.asset_disposals (
  id serial not null,
  disposal_number text not null,
  asset_id integer not null,
  disposal_type text not null default 'scrap',              -- scrap | sale | donation | trade_in | write_off | lost
  disposal_date date null,
  reason text null,
  book_value_at_disposal numeric(18, 4) null,
  sale_value numeric(18, 4) null,
  gain_loss_amount numeric(18, 4) null,
  buyer_details text null,
  status text not null default 'draft',                     -- draft | submitted | in_approval | approved | rejected |
                                                            -- completed | cancelled
  workflow_instance_id integer null,
  approved_at timestamp without time zone null,
  completed_at timestamp without time zone null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_disposals_pkey primary key (id),
  constraint adsp_tenant_number_key unique (tenant_id, disposal_number),
  constraint adsp_asset_fkey foreign key (asset_id) references assets (id),
  constraint adsp_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint adsp_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint adsp_status_check check (status in ('draft','submitted','in_approval','approved','rejected','completed','cancelled'))
) tablespace pg_default;

create table public.asset_audits (
  id serial not null,
  audit_number text not null,
  title text null,
  location_id integer null,                                 -- scope: location and/or category
  category_id integer null,
  planned_start_date date null,
  planned_end_date date null,
  actual_start_date date null,
  actual_end_date date null,
  conducted_by integer null,
  status text not null default 'planned',                   -- planned | in_progress | completed | cancelled
  summary text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_audits_pkey primary key (id),
  constraint aaud_tenant_number_key unique (tenant_id, audit_number),
  constraint aaud_location_fkey foreign key (location_id) references locations (id),
  constraint aaud_category_fkey foreign key (category_id) references categories (id),
  constraint aaud_conducted_by_fkey foreign key (conducted_by) references users (id),
  constraint aaud_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.asset_audit_items (
  id serial not null,
  audit_id integer not null,
  asset_id integer not null,
  expected_location_id integer null,
  found_location_id integer null,
  expected_user_id integer null,
  found_user_id integer null,
  condition_found_id integer null,
  verification_status text null default 'pending',          -- pending | verified | not_found | location_mismatch |
                                                            -- custodian_mismatch | damaged
  verified_by integer null,
  verified_at timestamp without time zone null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint asset_audit_items_pkey primary key (id),
  constraint aaudi_audit_asset_key unique (audit_id, asset_id),
  constraint aaudi_audit_fkey foreign key (audit_id) references asset_audits (id) on delete cascade,
  constraint aaudi_asset_fkey foreign key (asset_id) references assets (id),
  constraint aaudi_exp_loc_fkey foreign key (expected_location_id) references locations (id),
  constraint aaudi_found_loc_fkey foreign key (found_location_id) references locations (id),
  constraint aaudi_exp_user_fkey foreign key (expected_user_id) references users (id),
  constraint aaudi_found_user_fkey foreign key (found_user_id) references users (id),
  constraint aaudi_condition_fkey foreign key (condition_found_id) references conditions (id),
  constraint aaudi_verified_by_fkey foreign key (verified_by) references users (id),
  constraint aaudi_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 08. MAINTENANCE
-- ============================================================================

create table public.maintenance_plans (
  id serial not null,
  code text not null,
  name text not null,
  descr text null,
  asset_id integer null,                                    -- plan for one asset...
  category_id integer null,                                 -- ...or all assets of a category
  location_id integer null,                                 -- optional location scope
  maintenance_type text not null default 'preventive',      -- preventive | predictive | statutory | calibration | inspection
  frequency_type text not null default 'monthly',           -- daily | weekly | monthly | quarterly | half_yearly |
                                                            -- yearly | meter_based | custom_days
  frequency_interval integer null default 1,                -- every N units of frequency_type
  custom_interval_days integer null,
  meter_uom text null,                                      -- hours | km | cycles (for meter_based)
  meter_interval numeric(18, 4) null,
  lead_days integer null default 7,                         -- create schedule N days before due
  estimated_duration_hours numeric(9, 2) null,
  estimated_cost numeric(18, 4) null,
  checklist jsonb null,                                     -- [{"task":"Check oil","mandatory":true}, ...]
  assigned_team text null,
  default_assignee_id integer null,
  default_vendor_id integer null,                           -- outsourced maintenance
  start_date date null,
  end_date date null,
  last_generated_date date null,
  next_due_date date null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint maintenance_plans_pkey primary key (id),
  constraint mplan_tenant_code_key unique (tenant_id, code),
  constraint mplan_asset_fkey foreign key (asset_id) references assets (id),
  constraint mplan_category_fkey foreign key (category_id) references categories (id),
  constraint mplan_location_fkey foreign key (location_id) references locations (id),
  constraint mplan_assignee_fkey foreign key (default_assignee_id) references users (id),
  constraint mplan_vendor_fkey foreign key (default_vendor_id) references vendors (id),
  constraint mplan_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.maintenance_schedules (
  id serial not null,
  plan_id integer not null,
  asset_id integer not null,
  due_date date not null,
  grace_days integer null default 0,
  status text not null default 'scheduled',                 -- scheduled | work_order_created | completed | missed |
                                                            -- skipped | cancelled
  work_order_id integer null,                               -- FK added after maintenance_work_orders
  completed_at timestamp without time zone null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint maintenance_schedules_pkey primary key (id),
  constraint msch_plan_fkey foreign key (plan_id) references maintenance_plans (id) on delete cascade,
  constraint msch_asset_fkey foreign key (asset_id) references assets (id),
  constraint msch_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint msch_status_check check (status in ('scheduled','work_order_created','completed','missed','skipped','cancelled'))
) tablespace pg_default;

create table public.maintenance_work_orders (
  id serial not null,
  wo_number text not null,
  title text null,
  descr text null,
  asset_id integer not null,
  maintenance_type text not null default 'corrective',      -- preventive | corrective | breakdown | emergency |
                                                            -- calibration | inspection | upgrade
  source text null default 'manual',                        -- manual | schedule | ticket
  schedule_id integer null,
  ticket_id integer null,                                   -- FK added after tickets
  priority text null default 'medium',                      -- low | medium | high | critical
  assigned_to integer null,
  assigned_team text null,
  vendor_id integer null,                                   -- outsourced
  location_id integer null,
  scheduled_start timestamp without time zone null,
  scheduled_end timestamp without time zone null,
  actual_start timestamp without time zone null,
  actual_end timestamp without time zone null,
  downtime_hours numeric(9, 2) null,
  meter_reading numeric(18, 4) null,
  labor_cost numeric(18, 4) null default 0,
  parts_cost numeric(18, 4) null default 0,
  vendor_cost numeric(18, 4) null default 0,
  other_cost numeric(18, 4) null default 0,
  total_cost numeric(18, 4) null default 0,
  status text not null default 'open',                      -- open | assigned | in_progress | on_hold | awaiting_parts |
                                                            -- completed | verified | closed | cancelled
  workflow_instance_id integer null,
  failure_cause text null,
  work_done text null,
  verified_by integer null,
  verified_at timestamp without time zone null,
  closed_at timestamp without time zone null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint maintenance_work_orders_pkey primary key (id),
  constraint mwo_tenant_number_key unique (tenant_id, wo_number),
  constraint mwo_asset_fkey foreign key (asset_id) references assets (id),
  constraint mwo_schedule_fkey foreign key (schedule_id) references maintenance_schedules (id),
  constraint mwo_assigned_fkey foreign key (assigned_to) references users (id),
  constraint mwo_vendor_fkey foreign key (vendor_id) references vendors (id),
  constraint mwo_location_fkey foreign key (location_id) references locations (id),
  constraint mwo_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint mwo_verified_by_fkey foreign key (verified_by) references users (id),
  constraint mwo_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint mwo_status_check check (status in ('open','assigned','in_progress','on_hold','awaiting_parts','completed','verified','closed','cancelled'))
) tablespace pg_default;

alter table public.maintenance_schedules
  add constraint msch_wo_fkey foreign key (work_order_id) references maintenance_work_orders (id);

alter table public.asset_movements
  add constraint amov_wo_fkey foreign key (work_order_id) references maintenance_work_orders (id);

create table public.maintenance_work_order_tasks (
  id serial not null,
  work_order_id integer not null,
  task_no integer null,
  task_descr text not null,
  is_mandatory boolean null default false,
  status text not null default 'pending',                   -- pending | done | skipped | failed
  done_by integer null,
  done_at timestamp without time zone null,
  reading_value text null,                                  -- measured value if applicable
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint mwo_tasks_pkey primary key (id),
  constraint mwot_wo_fkey foreign key (work_order_id) references maintenance_work_orders (id) on delete cascade,
  constraint mwot_done_by_fkey foreign key (done_by) references users (id),
  constraint mwot_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.maintenance_work_order_parts (
  id serial not null,
  work_order_id integer not null,
  item_id integer not null,
  warehouse_id integer null,
  quantity numeric(18, 4) not null,
  unit_cost numeric(18, 4) null,
  total_cost numeric(18, 4) null,
  stock_transaction_id integer null,
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint mwo_parts_pkey primary key (id),
  constraint mwop_wo_fkey foreign key (work_order_id) references maintenance_work_orders (id) on delete cascade,
  constraint mwop_item_fkey foreign key (item_id) references items (id),
  constraint mwop_wh_fkey foreign key (warehouse_id) references warehouses (id),
  constraint mwop_stock_txn_fkey foreign key (stock_transaction_id) references stock_transactions (id),
  constraint mwop_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 09. TICKETING (issues raised against assets)
-- ============================================================================

create table public.sla_policies (
  id serial not null,
  code text not null,
  name text not null,
  priority text not null default 'medium',                  -- low | medium | high | critical
  response_time_minutes integer not null,
  resolution_time_minutes integer not null,
  business_hours_only boolean null default true,
  escalation_after_minutes integer null,
  escalate_to_role_id integer null,
  escalate_to_user_id integer null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint sla_policies_pkey primary key (id),
  constraint sla_tenant_code_key unique (tenant_id, code),
  constraint sla_esc_role_fkey foreign key (escalate_to_role_id) references roles (id),
  constraint sla_esc_user_fkey foreign key (escalate_to_user_id) references users (id),
  constraint sla_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.tickets (
  id serial not null,
  ticket_number text not null,
  subject text not null,
  descr text null,
  ticket_type text null default 'incident',                 -- incident | service_request | complaint | change_request
  asset_id integer null,                                    -- ticket raised against this asset
  category_id integer null,                                 -- categories.category_type = 'ticket'
  location_id integer null,
  raised_by integer not null,
  raised_on_behalf_of integer null,
  channel text null default 'web',                          -- web | email | phone | mobile | qr_scan
  priority text not null default 'medium',                  -- low | medium | high | critical
  severity text null,                                       -- s1 | s2 | s3 | s4
  impact text null,                                         -- individual | department | site | organization
  status text not null default 'open',                      -- open | assigned | in_progress | on_hold |
                                                            -- awaiting_user | awaiting_vendor | resolved |
                                                            -- closed | reopened | cancelled
  assigned_to integer null,
  assigned_team text null,
  assigned_at timestamp without time zone null,
  sla_policy_id integer null,
  response_due_at timestamp without time zone null,
  resolution_due_at timestamp without time zone null,
  first_response_at timestamp without time zone null,
  is_sla_breached boolean null default false,
  work_order_id integer null,                               -- escalated into maintenance work order
  workflow_instance_id integer null,
  resolved_at timestamp without time zone null,
  resolved_by integer null,
  resolution_notes text null,
  closed_at timestamp without time zone null,
  closed_by integer null,
  reopen_count integer null default 0,
  satisfaction_rating integer null,                         -- 1..5
  satisfaction_comments text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint tickets_pkey primary key (id),
  constraint tickets_tenant_number_key unique (tenant_id, ticket_number),
  constraint tickets_asset_fkey foreign key (asset_id) references assets (id),
  constraint tickets_category_fkey foreign key (category_id) references categories (id),
  constraint tickets_location_fkey foreign key (location_id) references locations (id),
  constraint tickets_raised_by_fkey foreign key (raised_by) references users (id),
  constraint tickets_behalf_fkey foreign key (raised_on_behalf_of) references users (id),
  constraint tickets_assigned_fkey foreign key (assigned_to) references users (id),
  constraint tickets_sla_fkey foreign key (sla_policy_id) references sla_policies (id),
  constraint tickets_wo_fkey foreign key (work_order_id) references maintenance_work_orders (id),
  constraint tickets_workflow_fkey foreign key (workflow_instance_id) references workflow_instances (id),
  constraint tickets_resolved_by_fkey foreign key (resolved_by) references users (id),
  constraint tickets_closed_by_fkey foreign key (closed_by) references users (id),
  constraint tickets_tenant_fkey foreign key (tenant_id) references tenants (id),
  constraint tickets_status_check check (status in ('open','assigned','in_progress','on_hold','awaiting_user','awaiting_vendor','resolved','closed','reopened','cancelled')),
  constraint tickets_rating_check check (satisfaction_rating is null or (satisfaction_rating between 1 and 5))
) tablespace pg_default;

alter table public.asset_movements
  add constraint amov_ticket_fkey foreign key (ticket_id) references tickets (id);

alter table public.maintenance_work_orders
  add constraint mwo_ticket_fkey foreign key (ticket_id) references tickets (id);

create table public.ticket_comments (
  id serial not null,
  ticket_id integer not null,
  comment text not null,
  is_internal boolean null default false,                   -- internal notes hidden from requester
  commented_by integer not null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint ticket_comments_pkey primary key (id),
  constraint tcom_ticket_fkey foreign key (ticket_id) references tickets (id) on delete cascade,
  constraint tcom_user_fkey foreign key (commented_by) references users (id),
  constraint tcom_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.ticket_activities (
  id serial not null,
  ticket_id integer not null,
  activity_type text not null,                              -- status_change | assignment | priority_change |
                                                            -- escalation | sla_breach | reopen | merge | comment
  from_value text null,
  to_value text null,
  performed_by integer null,                                -- null = system
  performed_at timestamp without time zone null default now(),
  remarks text null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint ticket_activities_pkey primary key (id),
  constraint tact_ticket_fkey foreign key (ticket_id) references tickets (id) on delete cascade,
  constraint tact_user_fkey foreign key (performed_by) references users (id),
  constraint tact_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 10. SHARED / CROSS-CUTTING
-- ============================================================================

create table public.attachments (
  id serial not null,
  entity_type text not null,                                -- any table name: 'assets','tickets','purchase_orders',...
  entity_id integer not null,
  file_name text not null,
  file_path text not null,                                  -- supabase storage path
  file_size_bytes bigint null,
  mime_type text null,
  attachment_type text null,                                -- invoice_copy | photo | manual | warranty_card | report
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint attachments_pkey primary key (id),
  constraint attachments_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.notifications (
  id serial not null,
  user_id integer not null,
  title text not null,
  body text null,
  notification_type text null,                              -- approval_pending | approved | rejected | sla_breach |
                                                            -- maintenance_due | warranty_expiry | ticket_update | stock_low
  entity_type text null,
  entity_id integer null,
  action_url text null,
  is_read boolean null default false,
  read_at timestamp without time zone null,
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint notifications_pkey primary key (id),
  constraint notif_user_fkey foreign key (user_id) references users (id) on delete cascade,
  constraint notif_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;

create table public.audit_logs (
  id bigserial not null,
  entity_type text not null,
  entity_id integer not null,
  action text not null,                                     -- insert | update | delete | status_change | login | export
  old_values jsonb null,
  new_values jsonb null,
  changed_fields text[] null,
  performed_by integer null,
  ip_address text null,
  user_agent text null,
  performed_at timestamp without time zone null default now(),
  data jsonb null,
  metadata jsonb null,
  access_control jsonb null,
  tenant_id integer not null,
  is_active boolean null default true,
  created_by integer null,
  created_at timestamp without time zone null default now(),
  updated_by integer null,
  updated_at timestamp without time zone null,
  constraint audit_logs_pkey primary key (id),
  constraint alog_tenant_fkey foreign key (tenant_id) references tenants (id)
) tablespace pg_default;


-- ============================================================================
-- 11. INDEXES (tenant_id on every table + hot query paths)
-- ============================================================================

create index if not exists idx_users_tenant on public.users (tenant_id);
create index if not exists idx_users_auth_uid on public.users (auth_uid);
create index if not exists idx_roles_tenant on public.roles (tenant_id);
create index if not exists idx_role_permissions_tenant on public.role_permissions (tenant_id);
create index if not exists idx_user_roles_tenant_user on public.user_roles (tenant_id, user_id);
create index if not exists idx_departments_tenant on public.departments (tenant_id);
create index if not exists idx_cost_centers_tenant on public.cost_centers (tenant_id);
create index if not exists idx_locations_tenant on public.locations (tenant_id);
create index if not exists idx_locations_parent on public.locations (parent_id);
create index if not exists idx_currencies_tenant on public.currencies (tenant_id);
create index if not exists idx_uoms_tenant on public.uoms (tenant_id);
create index if not exists idx_tax_codes_tenant on public.tax_codes (tenant_id);
create index if not exists idx_categories_tenant_type on public.categories (tenant_id, category_type);
create index if not exists idx_conditions_tenant on public.conditions (tenant_id);
create index if not exists idx_movement_types_tenant on public.movement_types (tenant_id);
create index if not exists idx_vendors_tenant on public.vendors (tenant_id);
create index if not exists idx_vendor_contacts_vendor on public.vendor_contacts (vendor_id);
create index if not exists idx_items_tenant on public.items (tenant_id);
create index if not exists idx_items_category on public.items (category_id);
create index if not exists idx_number_series_tenant on public.number_series (tenant_id);
create index if not exists idx_app_settings_tenant on public.app_settings (tenant_id);

create index if not exists idx_wf_defs_tenant_entity on public.workflow_definitions (tenant_id, entity_type);
create index if not exists idx_wf_steps_def on public.workflow_steps (workflow_definition_id);
create index if not exists idx_wf_instances_tenant_entity on public.workflow_instances (tenant_id, entity_type, entity_id);
create index if not exists idx_wf_instances_status on public.workflow_instances (tenant_id, status);
create index if not exists idx_wf_actions_instance on public.workflow_actions (workflow_instance_id);
create index if not exists idx_delegations_tenant_from on public.approval_delegations (tenant_id, from_user_id);

create index if not exists idx_pr_tenant_status on public.purchase_requisitions (tenant_id, status);
create index if not exists idx_pr_requested_by on public.purchase_requisitions (requested_by);
create index if not exists idx_pr_items_pr on public.purchase_requisition_items (pr_id);
create index if not exists idx_rfqs_tenant on public.rfqs (tenant_id);
create index if not exists idx_rfq_items_rfq on public.rfq_items (rfq_id);
create index if not exists idx_rfq_vendors_rfq on public.rfq_vendors (rfq_id);
create index if not exists idx_vq_tenant on public.vendor_quotations (tenant_id);
create index if not exists idx_vq_rfq on public.vendor_quotations (rfq_id);
create index if not exists idx_vq_items_quotation on public.vendor_quotation_items (quotation_id);
create index if not exists idx_po_tenant_status on public.purchase_orders (tenant_id, status);
create index if not exists idx_po_vendor on public.purchase_orders (vendor_id);
create index if not exists idx_po_items_po on public.purchase_order_items (po_id);
create index if not exists idx_grn_tenant on public.goods_receipts (tenant_id);
create index if not exists idx_grn_po on public.goods_receipts (po_id);
create index if not exists idx_grn_items_grn on public.goods_receipt_items (grn_id);
create index if not exists idx_pinv_tenant_status on public.purchase_invoices (tenant_id, status);
create index if not exists idx_pinv_items_invoice on public.purchase_invoice_items (invoice_id);
create index if not exists idx_vpay_tenant on public.vendor_payments (tenant_id);

create index if not exists idx_warehouses_tenant on public.warehouses (tenant_id);
create index if not exists idx_item_stocks_tenant_item on public.item_stocks (tenant_id, item_id);
create index if not exists idx_stock_txn_tenant_item on public.stock_transactions (tenant_id, item_id, txn_date);
create index if not exists idx_stock_txn_ref on public.stock_transactions (ref_entity_type, ref_entity_id);

create index if not exists idx_dep_methods_tenant on public.depreciation_methods (tenant_id);
create index if not exists idx_assets_tenant_status on public.assets (tenant_id, status);
create index if not exists idx_assets_category on public.assets (category_id);
create index if not exists idx_assets_location on public.assets (location_id);
create index if not exists idx_assets_allocated_user on public.assets (allocated_to_user_id);
create index if not exists idx_assets_serial on public.assets (tenant_id, serial_no);
create index if not exists idx_amov_asset on public.asset_movements (asset_id, movement_date);
create index if not exists idx_amov_tenant on public.asset_movements (tenant_id);
create index if not exists idx_atrf_tenant_status on public.asset_transfers (tenant_id, status);
create index if not exists idx_atrf_items_transfer on public.asset_transfer_items (transfer_id);
create index if not exists idx_adsch_asset on public.asset_depreciation_schedules (asset_id);
create index if not exists idx_adent_asset on public.asset_depreciation_entries (asset_id, depreciation_date);
create index if not exists idx_adent_tenant_fy on public.asset_depreciation_entries (tenant_id, fiscal_year, period_no);
create index if not exists idx_awar_asset on public.asset_warranties (asset_id);
create index if not exists idx_awar_end_date on public.asset_warranties (tenant_id, end_date);
create index if not exists idx_adsp_tenant on public.asset_disposals (tenant_id);
create index if not exists idx_aaud_tenant on public.asset_audits (tenant_id);
create index if not exists idx_aaudi_audit on public.asset_audit_items (audit_id);

create index if not exists idx_mplan_tenant on public.maintenance_plans (tenant_id);
create index if not exists idx_mplan_next_due on public.maintenance_plans (tenant_id, next_due_date);
create index if not exists idx_msch_tenant_due on public.maintenance_schedules (tenant_id, due_date, status);
create index if not exists idx_msch_asset on public.maintenance_schedules (asset_id);
create index if not exists idx_mwo_tenant_status on public.maintenance_work_orders (tenant_id, status);
create index if not exists idx_mwo_asset on public.maintenance_work_orders (asset_id);
create index if not exists idx_mwo_assigned on public.maintenance_work_orders (assigned_to);
create index if not exists idx_mwot_wo on public.maintenance_work_order_tasks (work_order_id);
create index if not exists idx_mwop_wo on public.maintenance_work_order_parts (work_order_id);

create index if not exists idx_sla_tenant on public.sla_policies (tenant_id);
create index if not exists idx_tickets_tenant_status on public.tickets (tenant_id, status);
create index if not exists idx_tickets_asset on public.tickets (asset_id);
create index if not exists idx_tickets_assigned on public.tickets (assigned_to);
create index if not exists idx_tickets_raised_by on public.tickets (raised_by);
create index if not exists idx_tickets_resolution_due on public.tickets (tenant_id, resolution_due_at) where status not in ('resolved','closed','cancelled');
create index if not exists idx_tcom_ticket on public.ticket_comments (ticket_id);
create index if not exists idx_tact_ticket on public.ticket_activities (ticket_id);

create index if not exists idx_attachments_entity on public.attachments (tenant_id, entity_type, entity_id);
create index if not exists idx_notif_user_unread on public.notifications (user_id) where is_read = false;
create index if not exists idx_alog_tenant_entity on public.audit_logs (tenant_id, entity_type, entity_id);
create index if not exists idx_alog_performed_at on public.audit_logs (performed_at);


-- ============================================================================
-- 12. VIEWS
-- ============================================================================

-- Asset age + remaining life
create or replace view public.v_asset_age as
select
  a.id,
  a.tenant_id,
  a.code,
  a.name,
  a.purchase_date,
  a.capitalization_date,
  coalesce(a.capitalization_date, a.purchase_date) as age_basis_date,
  case when coalesce(a.capitalization_date, a.purchase_date) is not null
       then date_part('year', age(current_date, coalesce(a.capitalization_date, a.purchase_date)))::int
  end as age_years,
  case when coalesce(a.capitalization_date, a.purchase_date) is not null
       then (date_part('year', age(current_date, coalesce(a.capitalization_date, a.purchase_date))) * 12
           + date_part('month', age(current_date, coalesce(a.capitalization_date, a.purchase_date))))::int
  end as age_months,
  a.useful_life_months,
  case when a.useful_life_months is not null
        and coalesce(a.capitalization_date, a.purchase_date) is not null
       then a.useful_life_months
          - (date_part('year', age(current_date, coalesce(a.capitalization_date, a.purchase_date))) * 12
           + date_part('month', age(current_date, coalesce(a.capitalization_date, a.purchase_date))))::int
  end as remaining_life_months,
  a.end_of_life,
  a.status
from public.assets a
where a.is_active = true;

-- Net book value summary
create or replace view public.v_asset_net_book_value as
select
  a.id,
  a.tenant_id,
  a.code,
  a.name,
  a.category_id,
  a.capitalization_price,
  a.salvage_value,
  a.accumulated_depreciation,
  coalesce(a.capitalization_price, a.purchase_price, 0)
    - coalesce(a.accumulated_depreciation, 0) as net_book_value,
  a.current_value,
  a.is_fully_depreciated,
  a.last_depreciation_date,
  a.status
from public.assets a
where a.is_active = true;

-- ============================================================================
-- END OF SCHEMA v1
-- Next steps (separate migrations):
--   - RLS policies per table:  using (tenant_id = (auth.jwt() ->> 'tenant_id')::int)
--   - updated_at triggers, audit triggers
--   - seed data (roles, permissions, movement types, depreciation methods)
--   - document numbering function using number_series (FOR UPDATE lock)
-- ============================================================================
