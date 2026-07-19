-- ============================================================================
-- 05. UI SEED — PROCUREMENT MODULE (pages / page_sections / section_controls)
-- Generated from the observed metadata conventions of the dynamic UI engine:
--   display_location_id : 17 = main menu, 19 = hidden (binding/list page)
--   page_type_id        : 23 = form page, 24 = report/list page
--   binding_type_id     : 25 = RPC function
--   platform_id         : 20 = web
--   section display     : 28 (default), child modes: 31 form, 32 editable grid,
--                         39 data table
--   control display     : 33 editable, 34 required, 36 readonly/column, 37 hidden
--   control types       : 1 text, 4 date, 9 number, 12 dropdown, 13 json,
--                         15 edit-link, 30 checkbox, 34 add-row, 35 delete-row
--   existing list pages : 75 cost_centers, 70 location_list, 80 vendor_list,
--                         18 user_list
--
-- Binds the RPC set from 04_rpc_functions_core.sql:
--   PR: fn_save/get/delete_purchase_requisition, fn_list_purchase_requisitions
--   PO: fn_save_purchase_order, fn_get_purchase_order, fn_list_purchase_orders
--   Allocation: fn_allocate_asset
--
-- TODO markers (decide before running):
--   [A] v_module_id — set to your Procurement module id in `modules`
--   [B] department / currency / tax-code / item / asset dropdowns need small
--       list pages (fn_get_department_list etc.) — left as text inputs or
--       null-bound dropdowns with comments
--   [C] fn_allocate_asset takes named params (p_asset_id, p_user_id, ...);
--       if the engine posts one JSON object, add a jsonb wrapper function
--
-- tenant_id = 0 (global pages), created_by = 1, route names globally unique.
-- ============================================================================

DO $$
DECLARE
  v_module_id     integer := 2;   -- TODO [A]: replace with Procurement module id
  v_root          integer;
  v_pr_page       integer;
  v_pr_list       integer;
  v_po_page       integer;
  v_po_list       integer;
  v_alloc_page    integer;
  v_sec           integer;
BEGIN

  -- ==========================================================================
  -- ROOT MENU PAGE
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Procurement', 'Purchase requisitions, orders and receipts',
          'procurement', 0, 17, 6, 23,
          NULL, NULL, NULL, NULL, 25, 20,
          '{"item_icon":"ShoppingCart","item_color":null,"tool_descr":null,"is_clear_page":null}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_root;

  -- ==========================================================================
  -- HIDDEN LIST PAGES (dropdown / report bindings)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Purchase Requisition List', 'PR list for reports and dropdown binding',
          'purchase_requisition_list', v_root, 19, 1, 24,
          NULL, 'fn_list_purchase_requisitions', NULL, NULL, 25, 20,
          0, true, 1, now())
  RETURNING id INTO v_pr_list;

  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Purchase Order List', 'PO list for reports and dropdown binding',
          'purchase_order_list', v_root, 19, 2, 24,
          NULL, 'fn_list_purchase_orders', NULL, NULL, 25, 20,
          0, true, 1, now())
  RETURNING id INTO v_po_list;

  -- ==========================================================================
  -- PAGE: PURCHASE REQUISITION (form)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data, metadata,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Purchase Requisition', 'Create and update purchase requisitions',
          'purchase_requisition', v_root, 17, 1, 23,
          'fn_save_purchase_requisition', 'fn_get_purchase_requisition',
          'fn_delete_purchase_requisition', 'id', 25, 20,
          '{"item_icon":"FileText","is_clear_page":true}'::jsonb,
          '{"table_name":"purchase_requisitions"}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_pr_page;

  -- --- Section: Requisition Details (form) ---------------------------------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_pr_page, 'Requisition Details', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',                 'id',                     NULL, 37, 1,  20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Title',              'title',                  NULL, 34, 2,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    -- TODO [B]: convert to dropdown (12) once a requisition-type quick list page exists
    (v_sec, 1,  'Requisition Type',   'requisition_type',       NULL, 33, 3,  20, '{"width":4,"default_value":"purchase"}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Priority',           'priority',               NULL, 33, 4,  20, '{"width":4,"default_value":"medium"}'::jsonb, 0, true, 1, now()),
    -- TODO [B]: needs department list page (fn_get_department_list)
    (v_sec, 12, 'Department',         'department_id',          NULL, 33, 5,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Cost Center',        'cost_center_id',         75,   33, 6,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Deliver To Location','deliver_to_location_id', 70,   33, 7,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Required By',        'required_by_date',       NULL, 33, 8,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Description',        'descr',                  NULL, 33, 9,  20, '{"width":12}'::jsonb, 0, true, 1, now());

  -- --- Section: Requisition Items (editable grid, payload key: items) ------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_pr_page, 'Requisition Items', NULL, 28, 2, 32, 'items', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    -- TODO [B]: bind item dropdown to an item list page when available (binding item_id)
    (v_sec, 1,  'Item / Description',   'item_descr',           NULL, 34, 1, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Quantity',             'quantity',             NULL, 34, 2, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Est. Unit Price',      'estimated_unit_price', NULL, 33, 3, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Required By',          'required_by_date',     NULL, 33, 4, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Suggested Vendor',     'suggested_vendor_id',  80,   33, 5, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',              'remarks',              NULL, 33, 6, 20, '{"width":3}'::jsonb, 0, true, 1, now()),
    (v_sec, 34, 'Add Row',              'add_row',              NULL, 33, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 35, 'Delete',               'delete_button',        NULL, 33, 8, 20, NULL, 0, true, 1, now());

  -- --- Section: Available Requisitions (data table) ------------------------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_pr_page, 'Available Requisitions', NULL, 28, 3, 39, 'fn_list_purchase_requisitions', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',            'id',                NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'PR Number',     'pr_number',         NULL, 36, 2, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Title',         'title',             NULL, 36, 3, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Status',        'status',            NULL, 36, 4, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Priority',      'priority',          NULL, 36, 5, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Requested By',  'requested_by_name', NULL, 36, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 9,  'Estimated Total','estimated_total',  NULL, 36, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 4,  'Required By',   'required_by_date',  NULL, 36, 8, 20, NULL, 0, true, 1, now()),
    (v_sec, 15, 'Edit',          'id',                NULL, 33, 9, 20,
     '{"item_icon":"Edit","item_color":"#26a145","default_value":"/purchase_requisition?id={id}"}'::jsonb,
     0, true, 1, now());

  -- ==========================================================================
  -- PAGE: PURCHASE ORDER (form)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data, metadata,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Purchase Order', 'Create and update purchase orders',
          'purchase_order', v_root, 17, 2, 23,
          'fn_save_purchase_order', 'fn_get_purchase_order', NULL, 'id', 25, 20,
          '{"item_icon":"ClipboardList","is_clear_page":true}'::jsonb,
          '{"table_name":"purchase_orders"}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_po_page;

  -- --- Section: Order Details (form) ----------------------------------------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_po_page, 'Order Details', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',                'id',                     NULL, 37, 1,  20, NULL, 0, true, 1, now()),
    (v_sec, 12, 'Vendor',            'vendor_id',              80,   34, 2,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'PO Date',           'po_date',                NULL, 34, 3,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Source PR',         'pr_id',                  NULL, 33, 4,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    -- ^ TODO [B]: set binding_list_page_id to the PR list page id after seeding
    (v_sec, 12, 'Ship To Location',  'ship_to_location_id',    70,   33, 5,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Expected Delivery', 'expected_delivery_date', NULL, 33, 6,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Payment Terms',     'payment_terms',          NULL, 33, 7,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Delivery Terms',    'delivery_terms',         NULL, 33, 8,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',           'remarks',                NULL, 33, 9,  20, '{"width":8}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Terms & Conditions','terms_and_conditions',   NULL, 33, 10, 20, '{"width":12}'::jsonb, 0, true, 1, now());

  -- --- Section: Order Items (editable grid, payload key: items) -------------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_po_page, 'Order Items', NULL, 28, 2, 32, 'items', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Item / Description', 'item_descr',             NULL, 34, 1, 20, '{"width":3}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Quantity',           'quantity',               NULL, 34, 2, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Unit Price',         'unit_price',             NULL, 34, 3, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Discount %',         'discount_percent',       NULL, 33, 4, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    -- TODO [B]: bind tax code dropdown to a tax code list page when available
    (v_sec, 12, 'Tax Code',           'tax_code_id',            NULL, 33, 5, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Expected Delivery',  'expected_delivery_date', NULL, 33, 6, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',            'remarks',                NULL, 33, 7, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 34, 'Add Row',            'add_row',                NULL, 33, 8, 20, NULL, 0, true, 1, now()),
    (v_sec, 35, 'Delete',             'delete_button',          NULL, 33, 9, 20, NULL, 0, true, 1, now());

  -- --- Section: Available Orders (data table) -------------------------------
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_po_page, 'Available Orders', NULL, 28, 3, 39, 'fn_list_purchase_orders', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',           'id',                     NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'PO Number',    'po_number',              NULL, 36, 2, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Vendor',       'vendor_name',            NULL, 36, 3, 20, NULL, 0, true, 1, now()),
    (v_sec, 4,  'PO Date',      'po_date',                NULL, 36, 4, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Status',       'status',                 NULL, 36, 5, 20, NULL, 0, true, 1, now()),
    (v_sec, 9,  'Total Amount', 'total_amount',           NULL, 36, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 4,  'Expected Delivery', 'expected_delivery_date', NULL, 36, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 15, 'Edit',         'id',                     NULL, 33, 8, 20,
     '{"item_icon":"Edit","item_color":"#26a145","default_value":"/purchase_order?id={id}"}'::jsonb,
     0, true, 1, now());

  -- fix the Source PR dropdown binding now that the PR list page id is known
  UPDATE section_controls sc
  SET binding_list_page_id = v_pr_list
  FROM page_sections ps
  WHERE sc.section_id = ps.id
    AND ps.page_id = v_po_page
    AND sc.binding_name = 'pr_id';

  -- ==========================================================================
  -- PAGE: ASSET ALLOCATION (action form)
  -- Posts one JSON object to fn_allocate_asset_ui (wrapper in 06 supplement)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Asset Allocation', 'Allocate an asset to a user',
          'asset_allocation', v_root, 17, 3, 23,
          'fn_allocate_asset_ui', NULL, NULL, NULL, 25, 20,
          '{"item_icon":"UserCheck","is_clear_page":true}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_alloc_page;

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_alloc_page, 'Allocation Details', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    -- TODO [B]: bind asset dropdown to an asset list page (available assets)
    (v_sec, 12, 'Asset',                'asset_id',             NULL, 34, 1, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Allocate To User',     'user_id',              18,   34, 2, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Expected Return Date', 'expected_return_date', NULL, 33, 3, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',              'remarks',              NULL, 33, 4, 20, '{"width":12}'::jsonb, 0, true, 1, now());

END $$;

-- ============================================================================
-- END 05 — verify with:
--   select p.id, p.name, p.route_name, count(distinct ps.id) sections,
--          count(sc.id) controls
--   from pages p
--   left join page_sections ps on ps.page_id = p.id
--   left join section_controls sc on sc.section_id = ps.id
--   where p.route_name in ('procurement','purchase_requisition','purchase_order',
--                          'purchase_requisition_list','purchase_order_list',
--                          'asset_allocation')
--   group by p.id, p.name, p.route_name order by p.id;
-- ============================================================================
