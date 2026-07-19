-- ============================================================================
-- 07. UI SEED — GOODS RECEIPT, WORK ORDER, APPROVAL INBOX
-- Run AFTER 05 (looks up 'procurement' root and 'purchase_order_list' by
-- route_name) and 06 (backing RPCs + UI wrappers).
-- Same engine conventions as 05.
-- ============================================================================

DO $$
DECLARE
  v_module_id    integer := 2;   -- TODO: Procurement / Maintenance module ids as applicable
  v_proc_root    integer;
  v_po_list      integer;
  v_grn_page     integer;
  v_wo_page      integer;
  v_inbox_page   integer;
  v_action_page  integer;
  v_sec          integer;
BEGIN
  SELECT id INTO v_proc_root FROM pages WHERE route_name = 'procurement';
  SELECT id INTO v_po_list   FROM pages WHERE route_name = 'purchase_order_list';

  IF v_proc_root IS NULL THEN
    RAISE EXCEPTION 'Run 05_ui_seed_procurement.sql first (procurement root page missing)';
  END IF;

  -- ==========================================================================
  -- PAGE: GOODS RECEIPT (form)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data, metadata,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Goods Receipt', 'Receive goods against a purchase order',
          'goods_receipt', v_proc_root, 17, 4, 23,
          'fn_save_goods_receipt', 'fn_get_goods_receipt', NULL, 'id', 25, 20,
          '{"item_icon":"PackageCheck","is_clear_page":true}'::jsonb,
          '{"table_name":"goods_receipts"}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_grn_page;

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_grn_page, 'Receipt Details', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',                  'id',                  NULL,      37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 12, 'Purchase Order',      'po_id',               v_po_list, 34, 2, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Receipt Date',        'receipt_date',        NULL,      34, 3, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    -- TODO: bind warehouse dropdown to a warehouse list page when available
    (v_sec, 12, 'Warehouse',           'warehouse_id',        NULL,      33, 4, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Vendor Challan No',   'vendor_challan_no',   NULL,      33, 5, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Vendor Challan Date', 'vendor_challan_date', NULL,      33, 6, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Vehicle No',          'vehicle_no',          NULL,      33, 7, 20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',             'remarks',             NULL,      33, 8, 20, '{"width":12}'::jsonb, 0, true, 1, now());

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_grn_page, 'Receipt Items', NULL, 28, 2, 32, 'items', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    -- po_item_id supplied by the engine when PO lines are loaded into the grid
    (v_sec, 1,  'PO Line',          'po_item_id',       NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Item',             'item_descr',       NULL, 36, 2, 20, '{"width":3}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Ordered Qty',      'ordered_qty',      NULL, 36, 3, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Received Qty',     'received_qty',     NULL, 34, 4, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Accepted Qty',     'accepted_qty',     NULL, 33, 5, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Rejected Qty',     'rejected_qty',     NULL, 33, 6, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Rejection Reason', 'rejection_reason', NULL, 33, 7, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Batch No',         'batch_no',         NULL, 33, 8, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',          'remarks',          NULL, 33, 9, 20, '{"width":2}'::jsonb, 0, true, 1, now());

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_grn_page, 'Available Receipts', NULL, 28, 3, 39, 'fn_list_goods_receipts', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',           'id',               NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'GRN Number',   'grn_number',       NULL, 36, 2, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'PO Number',    'po_number',        NULL, 36, 3, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Vendor',       'vendor_name',      NULL, 36, 4, 20, NULL, 0, true, 1, now()),
    (v_sec, 4,  'Receipt Date', 'receipt_date',     NULL, 36, 5, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Status',       'status',           NULL, 36, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Received By',  'received_by_name', NULL, 36, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 15, 'Edit',         'id',               NULL, 33, 8, 20,
     '{"item_icon":"Edit","item_color":"#26a145","default_value":"/goods_receipt?id={id}"}'::jsonb,
     0, true, 1, now());

  -- ==========================================================================
  -- PAGE: MAINTENANCE WORK ORDER (form) — under Asset Management module
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data, metadata,
                     tenant_id, is_active, created_by, created_at)
  VALUES (2, 'Maintenance Work Order', 'Preventive and corrective maintenance work orders',
          'maintenance_work_order', 2, 17, 6, 23,
          'fn_save_maintenance_work_order', 'fn_get_maintenance_work_order', NULL, 'id', 25, 20,
          '{"item_icon":"Wrench","is_clear_page":true}'::jsonb,
          '{"table_name":"maintenance_work_orders"}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_wo_page;

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_wo_page, 'Work Order Details', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',               'id',               NULL, 37, 1,  20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Title',            'title',            NULL, 34, 2,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    -- TODO: bind asset dropdown to an asset list page (fn_get_assets binding page)
    (v_sec, 12, 'Asset',            'asset_id',         NULL, 34, 3,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Maintenance Type', 'maintenance_type', NULL, 33, 4,  20, '{"width":4,"default_value":"corrective"}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Priority',         'priority',         NULL, 33, 5,  20, '{"width":4,"default_value":"medium"}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Assigned To',      'assigned_to',      18,   33, 6,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 12, 'Vendor',           'vendor_id',        80,   33, 7,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Scheduled Start',  'scheduled_start',  NULL, 33, 8,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 4,  'Scheduled End',    'scheduled_end',    NULL, 33, 9,  20, '{"width":4}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Labor Cost',       'labor_cost',       NULL, 33, 10, 20, '{"width":3}'::jsonb, 0, true, 1, now()),
    (v_sec, 9,  'Vendor Cost',      'vendor_cost',      NULL, 33, 11, 20, '{"width":3}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Failure Cause',    'failure_cause',    NULL, 33, 12, 20, '{"width":6}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Description',      'descr',            NULL, 33, 13, 20, '{"width":12}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Work Done',        'work_done',        NULL, 33, 14, 20, '{"width":12}'::jsonb, 0, true, 1, now());

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_wo_page, 'Checklist / Tasks', NULL, 28, 2, 32, 'tasks', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Task',          'task_descr',    NULL, 34, 1, 20, '{"width":5}'::jsonb, 0, true, 1, now()),
    (v_sec, 30, 'Mandatory',     'is_mandatory',  NULL, 33, 2, 20, '{"width":1}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Status',        'status',        NULL, 33, 3, 20, '{"width":2,"default_value":"pending"}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Reading Value', 'reading_value', NULL, 33, 4, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 1,  'Remarks',       'remarks',       NULL, 33, 5, 20, '{"width":2}'::jsonb, 0, true, 1, now()),
    (v_sec, 34, 'Add Row',       'add_row',       NULL, 33, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 35, 'Delete',        'delete_button', NULL, 33, 7, 20, NULL, 0, true, 1, now());

  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_wo_page, 'Available Work Orders', NULL, 28, 3, 39, 'fn_list_maintenance_work_orders', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Id',          'id',               NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'WO Number',   'wo_number',        NULL, 36, 2, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Title',       'title',            NULL, 36, 3, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Asset',       'asset_name',       NULL, 36, 4, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Type',        'maintenance_type', NULL, 36, 5, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Priority',    'priority',         NULL, 36, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Status',      'status',           NULL, 36, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Assigned To', 'assigned_to_name', NULL, 36, 8, 20, NULL, 0, true, 1, now()),
    (v_sec, 9,  'Total Cost',  'total_cost',       NULL, 36, 9, 20, NULL, 0, true, 1, now()),
    (v_sec, 15, 'Edit',        'id',               NULL, 33, 10, 20,
     '{"item_icon":"Edit","item_color":"#26a145","default_value":"/maintenance_work_order?id={id}"}'::jsonb,
     0, true, 1, now());

  -- ==========================================================================
  -- PAGE: APPROVAL INBOX (report) + WORKFLOW ACTION (form)
  -- ==========================================================================
  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Approval Inbox', 'Documents waiting for your approval',
          'approval_inbox', v_proc_root, 17, 5, 24,
          NULL, 'fn_list_pending_approvals', NULL, NULL, 25, 20,
          '{"item_icon":"Inbox","item_color":"#e67e22"}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_inbox_page;

  INSERT INTO pages (module_id, name, descr, route_name, parent_page_id,
                     display_location_id, display_order, page_type_id,
                     binding_name_post, binding_name_get, binding_name_delete,
                     binding_id_name, binding_type_id, platform_id, data,
                     tenant_id, is_active, created_by, created_at)
  VALUES (v_module_id, 'Workflow Action', 'Approve, reject or return a document',
          'workflow_action', v_inbox_page, 19, 1, 23,
          'fn_action_workflow_step_ui', NULL, NULL, NULL, 25, 20,
          '{"is_clear_page":true}'::jsonb,
          0, true, 1, now())
  RETURNING id INTO v_action_page;

  -- inbox list section
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_inbox_page, 'Pending Approvals', NULL, 28, 1, 39, 'fn_list_pending_approvals', 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1,  'Instance',     'workflow_instance_id', NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Document Type','entity_type',          NULL, 36, 2, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Doc Number',   'doc_number',           NULL, 36, 3, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Title',        'doc_title',            NULL, 36, 4, 20, NULL, 0, true, 1, now()),
    (v_sec, 9,  'Amount',       'doc_amount',           NULL, 36, 5, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Step',         'step_name',            NULL, 36, 6, 20, NULL, 0, true, 1, now()),
    (v_sec, 1,  'Initiated By', 'initiated_by_name',    NULL, 36, 7, 20, NULL, 0, true, 1, now()),
    (v_sec, 4,  'Initiated At', 'initiated_at',         NULL, 36, 8, 20, NULL, 0, true, 1, now()),
    (v_sec, 15, 'Act',          'workflow_instance_id', NULL, 33, 9, 20,
     '{"item_icon":"CheckSquare","item_color":"#2d9f5e","default_value":"/workflow_action?workflow_instance_id={workflow_instance_id}"}'::jsonb,
     0, true, 1, now());

  -- workflow action form section
  INSERT INTO page_sections (page_id, name, description, display_mode_id, display_order,
                             child_display_mode_id, binding_name, platform_id,
                             tenant_id, is_active, created_by, created_at)
  VALUES (v_action_page, 'Action', NULL, 28, 1, 31, NULL, 20, 0, true, 1, now())
  RETURNING id INTO v_sec;

  INSERT INTO section_controls (section_id, control_type_id, name, binding_name,
                                binding_list_page_id, display_mode_id, display_order,
                                platform_id, data, tenant_id, is_active, created_by, created_at)
  VALUES
    (v_sec, 1, 'Workflow Instance', 'workflow_instance_id', NULL, 37, 1, 20, NULL, 0, true, 1, now()),
    -- TODO: convert to dropdown backed by a quick list (approved / rejected / returned)
    (v_sec, 1, 'Action',            'action',               NULL, 34, 2, 20, '{"width":4,"default_value":"approved"}'::jsonb, 0, true, 1, now()),
    (v_sec, 1, 'Comments',          'comments',             NULL, 33, 3, 20, '{"width":12}'::jsonb, 0, true, 1, now());

END $$;

-- ============================================================================
-- END 07
-- ============================================================================
