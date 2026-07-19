-- ============================================================================
-- 06. SUPPLEMENT RPC FUNCTIONS
-- Backing functions for the remaining UI pages + jsonb UI wrappers so every
-- form page can post ONE JSON object (engine payload convention).
--
-- Contents:
--   GRN        : fn_save_goods_receipt, fn_get_goods_receipt, fn_list_goods_receipts
--   Work Order : fn_save_maintenance_work_order, fn_get_maintenance_work_order,
--                fn_list_maintenance_work_orders
--   Approvals  : fn_list_pending_approvals
--   UI wrappers: fn_allocate_asset_ui, fn_deallocate_asset_ui,
--                fn_action_workflow_step_ui
--   Grants
-- Standards: same as 04 (SECURITY DEFINER, search_path, ctx, response envelope).
-- ============================================================================


-- ============================================================================
-- GOODS RECEIPTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_save_goods_receipt(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx  t_request_context;
  v_id   integer;
  v_row  goods_receipts%ROWTYPE;
  v_item jsonb;
  v_po   purchase_orders%ROWTYPE;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_goods_receipt');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL THEN
      IF (p_payload->>'po_id') IS NULL THEN
        RAISE EXCEPTION 'po_id is required';
      END IF;

      SELECT * INTO v_po
      FROM purchase_orders
      WHERE tenant_id = v_ctx.tenant_id
        AND id = (p_payload->>'po_id')::integer
        AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order not found';
      END IF;
      IF v_po.status NOT IN ('approved', 'sent_to_vendor', 'acknowledged', 'partially_received') THEN
        RAISE EXCEPTION 'Goods cannot be received against a purchase order in status %', v_po.status;
      END IF;

      INSERT INTO goods_receipts (
        grn_number, po_id, vendor_id, receipt_date, received_by, warehouse_id,
        vendor_challan_no, vendor_challan_date, vehicle_no, remarks, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('GRN'),
        v_po.id,
        v_po.vendor_id,
        coalesce(nullif(p_payload->>'receipt_date', '')::date, current_date),
        v_ctx.caller_id,
        nullif(p_payload->>'warehouse_id', '')::integer,
        p_payload->>'vendor_challan_no',
        nullif(p_payload->>'vendor_challan_date', '')::date,
        p_payload->>'vehicle_no',
        p_payload->>'remarks',
        'draft',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row
      FROM goods_receipts
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Goods receipt not found';
      END IF;
      IF v_row.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft goods receipts can be edited';
      END IF;

      UPDATE goods_receipts SET
        receipt_date        = coalesce(nullif(p_payload->>'receipt_date', '')::date, receipt_date),
        warehouse_id        = coalesce(nullif(p_payload->>'warehouse_id', '')::integer, warehouse_id),
        vendor_challan_no   = coalesce(p_payload->>'vendor_challan_no', vendor_challan_no),
        vendor_challan_date = coalesce(nullif(p_payload->>'vendor_challan_date', '')::date, vendor_challan_date),
        vehicle_no          = coalesce(p_payload->>'vehicle_no', vehicle_no),
        remarks             = coalesce(p_payload->>'remarks', remarks),
        updated_by          = v_ctx.caller_id,
        updated_at          = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    IF p_payload ? 'items' THEN
      UPDATE goods_receipt_items
      SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE grn_id = v_row.id AND tenant_id = v_ctx.tenant_id AND is_active = true;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
      LOOP
        IF (v_item->>'po_item_id') IS NULL THEN
          RAISE EXCEPTION 'po_item_id is required on every receipt line';
        END IF;
        IF (v_item->>'received_qty') IS NULL OR (v_item->>'received_qty')::numeric <= 0 THEN
          RAISE EXCEPTION 'received_qty must be greater than zero';
        END IF;
        IF coalesce(nullif(v_item->>'accepted_qty', '')::numeric, 0)
           + coalesce(nullif(v_item->>'rejected_qty', '')::numeric, 0)
           > (v_item->>'received_qty')::numeric THEN
          RAISE EXCEPTION 'accepted + rejected quantity cannot exceed received quantity';
        END IF;

        INSERT INTO goods_receipt_items (
          grn_id, po_item_id, item_id, ordered_qty, received_qty, accepted_qty,
          rejected_qty, rejection_reason, unit_price, batch_no, serial_numbers, remarks,
          tenant_id, created_by, created_at, updated_by, updated_at)
        SELECT
          v_row.id, poi.id, poi.item_id, poi.quantity,
          (v_item->>'received_qty')::numeric,
          coalesce(nullif(v_item->>'accepted_qty', '')::numeric, (v_item->>'received_qty')::numeric),
          coalesce(nullif(v_item->>'rejected_qty', '')::numeric, 0),
          v_item->>'rejection_reason',
          poi.unit_price,
          v_item->>'batch_no',
          v_item->'serial_numbers',
          v_item->>'remarks',
          v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now()
        FROM purchase_order_items poi
        WHERE poi.id = (v_item->>'po_item_id')::integer
          AND poi.tenant_id = v_ctx.tenant_id
          AND poi.is_active = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Purchase order line % not found', v_item->>'po_item_id';
        END IF;
      END LOOP;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Goods receipt saved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_goods_receipt', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_get_goods_receipt(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_goods_receipt');

    SELECT to_jsonb(g)
           || jsonb_build_object(
                'po_number', po.po_number,
                'vendor_name', v.name,
                'items', coalesce((SELECT jsonb_agg(to_jsonb(i))
                                   FROM goods_receipt_items i
                                   WHERE i.grn_id = g.id
                                     AND i.tenant_id = v_ctx.tenant_id
                                     AND i.is_active = true), '[]'::jsonb))
    INTO v_result
    FROM goods_receipts g
    LEFT JOIN purchase_orders po ON po.id = g.po_id
    LEFT JOIN vendors v ON v.id = g.vendor_id
    WHERE g.tenant_id = v_ctx.tenant_id
      AND g.id = p_id
      AND g.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Goods receipt not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_goods_receipt', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_goods_receipts(
  p_page_index integer DEFAULT 1,
  p_page_size  integer DEFAULT 20,
  p_status     text    DEFAULT NULL,
  p_po_id      integer DEFAULT NULL,
  p_search     text    DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_goods_receipts');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM goods_receipts g
    WHERE g.tenant_id = v_ctx.tenant_id
      AND g.is_active = true
      AND (p_status IS NULL OR g.status = p_status)
      AND (p_po_id IS NULL OR g.po_id = p_po_id)
      AND (p_search IS NULL OR g.grn_number ILIKE '%' || p_search || '%');

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT g.id, g.grn_number, g.receipt_date, g.status, g.created_at,
             po.po_number, v.name AS vendor_name,
             u.first_name || coalesce(' ' || u.last_name, '') AS received_by_name
      FROM goods_receipts g
      LEFT JOIN purchase_orders po ON po.id = g.po_id
      LEFT JOIN vendors v ON v.id = g.vendor_id
      LEFT JOIN users u ON u.id = g.received_by
      WHERE g.tenant_id = v_ctx.tenant_id
        AND g.is_active = true
        AND (p_status IS NULL OR g.status = p_status)
        AND (p_po_id IS NULL OR g.po_id = p_po_id)
        AND (p_search IS NULL OR g.grn_number ILIKE '%' || p_search || '%')
      ORDER BY g.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_goods_receipts', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- MAINTENANCE WORK ORDERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_save_maintenance_work_order(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx  t_request_context;
  v_id   integer;
  v_row  maintenance_work_orders%ROWTYPE;
  v_item jsonb;
  v_no   integer := 0;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_save_maintenance_work_order');
    v_id  := nullif(p_payload->>'id', '')::integer;

    IF v_id IS NULL THEN
      IF (p_payload->>'asset_id') IS NULL THEN
        RAISE EXCEPTION 'asset_id is required';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM assets
                     WHERE tenant_id = v_ctx.tenant_id
                       AND id = (p_payload->>'asset_id')::integer
                       AND is_active = true) THEN
        RAISE EXCEPTION 'Asset not found';
      END IF;

      INSERT INTO maintenance_work_orders (
        wo_number, title, descr, asset_id, maintenance_type, source, ticket_id,
        priority, assigned_to, assigned_team, vendor_id, location_id,
        scheduled_start, scheduled_end, status,
        tenant_id, created_by, created_at, updated_by, updated_at)
      VALUES (
        fn_get_next_doc_number('WO'),
        p_payload->>'title',
        p_payload->>'descr',
        (p_payload->>'asset_id')::integer,
        coalesce(nullif(p_payload->>'maintenance_type', ''), 'corrective'),
        coalesce(nullif(p_payload->>'source', ''), 'manual'),
        nullif(p_payload->>'ticket_id', '')::integer,
        coalesce(nullif(p_payload->>'priority', ''), 'medium'),
        nullif(p_payload->>'assigned_to', '')::integer,
        p_payload->>'assigned_team',
        nullif(p_payload->>'vendor_id', '')::integer,
        nullif(p_payload->>'location_id', '')::integer,
        nullif(p_payload->>'scheduled_start', '')::timestamp,
        nullif(p_payload->>'scheduled_end', '')::timestamp,
        'open',
        v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now())
      RETURNING * INTO v_row;
    ELSE
      SELECT * INTO v_row
      FROM maintenance_work_orders
      WHERE tenant_id = v_ctx.tenant_id AND id = v_id AND is_active = true;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
      END IF;
      IF v_row.status IN ('closed', 'cancelled') THEN
        RAISE EXCEPTION 'Closed or cancelled work orders cannot be edited';
      END IF;

      UPDATE maintenance_work_orders SET
        title            = coalesce(p_payload->>'title', title),
        descr            = coalesce(p_payload->>'descr', descr),
        maintenance_type = coalesce(nullif(p_payload->>'maintenance_type', ''), maintenance_type),
        priority         = coalesce(nullif(p_payload->>'priority', ''), priority),
        assigned_to      = coalesce(nullif(p_payload->>'assigned_to', '')::integer, assigned_to),
        assigned_team    = coalesce(p_payload->>'assigned_team', assigned_team),
        vendor_id        = coalesce(nullif(p_payload->>'vendor_id', '')::integer, vendor_id),
        scheduled_start  = coalesce(nullif(p_payload->>'scheduled_start', '')::timestamp, scheduled_start),
        scheduled_end    = coalesce(nullif(p_payload->>'scheduled_end', '')::timestamp, scheduled_end),
        actual_start     = coalesce(nullif(p_payload->>'actual_start', '')::timestamp, actual_start),
        actual_end       = coalesce(nullif(p_payload->>'actual_end', '')::timestamp, actual_end),
        downtime_hours   = coalesce(nullif(p_payload->>'downtime_hours', '')::numeric, downtime_hours),
        labor_cost       = coalesce(nullif(p_payload->>'labor_cost', '')::numeric, labor_cost),
        vendor_cost      = coalesce(nullif(p_payload->>'vendor_cost', '')::numeric, vendor_cost),
        other_cost       = coalesce(nullif(p_payload->>'other_cost', '')::numeric, other_cost),
        total_cost       = coalesce(nullif(p_payload->>'labor_cost', '')::numeric, labor_cost, 0)
                           + coalesce(parts_cost, 0)
                           + coalesce(nullif(p_payload->>'vendor_cost', '')::numeric, vendor_cost, 0)
                           + coalesce(nullif(p_payload->>'other_cost', '')::numeric, other_cost, 0),
        status           = coalesce(nullif(p_payload->>'status', ''), status),
        failure_cause    = coalesce(p_payload->>'failure_cause', failure_cause),
        work_done        = coalesce(p_payload->>'work_done', work_done),
        updated_by       = v_ctx.caller_id,
        updated_at       = now()
      WHERE id = v_id AND tenant_id = v_ctx.tenant_id
      RETURNING * INTO v_row;
    END IF;

    IF p_payload ? 'tasks' THEN
      UPDATE maintenance_work_order_tasks
      SET is_active = false, updated_by = v_ctx.caller_id, updated_at = now()
      WHERE work_order_id = v_row.id AND tenant_id = v_ctx.tenant_id AND is_active = true;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'tasks')
      LOOP
        v_no := v_no + 1;
        IF (v_item->>'task_descr') IS NULL THEN
          RAISE EXCEPTION 'Task %: task_descr is required', v_no;
        END IF;

        INSERT INTO maintenance_work_order_tasks (
          work_order_id, task_no, task_descr, is_mandatory, status,
          reading_value, remarks,
          tenant_id, created_by, created_at, updated_by, updated_at)
        VALUES (
          v_row.id, v_no,
          v_item->>'task_descr',
          coalesce((v_item->>'is_mandatory')::boolean, false),
          coalesce(nullif(v_item->>'status', ''), 'pending'),
          v_item->>'reading_value',
          v_item->>'remarks',
          v_ctx.tenant_id, v_ctx.caller_id, now(), v_ctx.caller_id, now());
      END LOOP;
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(to_jsonb(v_row)),
      p_message := 'Work order saved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_save_maintenance_work_order', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_get_maintenance_work_order(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx    t_request_context;
  v_result jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_get_maintenance_work_order');

    SELECT to_jsonb(w)
           || jsonb_build_object(
                'asset_name', a.name,
                'asset_code', a.code,
                'assigned_to_name', u.first_name || coalesce(' ' || u.last_name, ''),
                'tasks', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.task_no)
                                   FROM maintenance_work_order_tasks t
                                   WHERE t.work_order_id = w.id
                                     AND t.tenant_id = v_ctx.tenant_id
                                     AND t.is_active = true), '[]'::jsonb))
    INTO v_result
    FROM maintenance_work_orders w
    LEFT JOIN assets a ON a.id = w.asset_id
    LEFT JOIN users u ON u.id = w.assigned_to
    WHERE w.tenant_id = v_ctx.tenant_id
      AND w.id = p_id
      AND w.is_active = true;

    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Work order not found';
    END IF;

    RETURN fn_response_success(
      p_data    := jsonb_build_array(v_result),
      p_message := 'Retrieved successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_get_maintenance_work_order', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_list_maintenance_work_orders(
  p_page_index integer DEFAULT 1,
  p_page_size  integer DEFAULT 20,
  p_status     text    DEFAULT NULL,
  p_asset_id   integer DEFAULT NULL,
  p_assigned_to integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_maintenance_work_orders');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    SELECT COUNT(*) INTO v_total
    FROM maintenance_work_orders w
    WHERE w.tenant_id = v_ctx.tenant_id
      AND w.is_active = true
      AND (p_status IS NULL OR w.status = p_status)
      AND (p_asset_id IS NULL OR w.asset_id = p_asset_id)
      AND (p_assigned_to IS NULL OR w.assigned_to = p_assigned_to);

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT w.id, w.wo_number, w.title, w.maintenance_type, w.priority, w.status,
             w.scheduled_start, w.scheduled_end, w.total_cost, w.created_at,
             a.code AS asset_code, a.name AS asset_name,
             u.first_name || coalesce(' ' || u.last_name, '') AS assigned_to_name
      FROM maintenance_work_orders w
      LEFT JOIN assets a ON a.id = w.asset_id
      LEFT JOIN users u ON u.id = w.assigned_to
      WHERE w.tenant_id = v_ctx.tenant_id
        AND w.is_active = true
        AND (p_status IS NULL OR w.status = p_status)
        AND (p_asset_id IS NULL OR w.asset_id = p_asset_id)
        AND (p_assigned_to IS NULL OR w.assigned_to = p_assigned_to)
      ORDER BY w.created_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN fn_response_error('fn_list_maintenance_work_orders', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- APPROVAL INBOX — pending workflow steps for the calling user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_list_pending_approvals(
  p_page_index integer DEFAULT 1,
  p_page_size  integer DEFAULT 20,
  p_entity_type text   DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx     t_request_context;
  v_offset  integer;
  v_total   integer;
  v_results jsonb;
BEGIN
  BEGIN
    v_ctx := fn_get_request_context('fn_list_pending_approvals');
    v_offset := (p_page_index - 1) * least(p_page_size, 200);

    CREATE TEMP TABLE IF NOT EXISTS tmp_pending ON COMMIT DROP AS
    SELECT wi.id AS workflow_instance_id,
           wi.entity_type,
           wi.entity_id,
           wi.current_step_no,
           ws.name AS step_name,
           wi.initiated_by,
           iu.first_name || coalesce(' ' || iu.last_name, '') AS initiated_by_name,
           wi.initiated_at,
           coalesce(pr.pr_number, po.po_number, atf.transfer_number,
                    ad.disposal_number, pinv.invoice_number) AS doc_number,
           coalesce(pr.title, v_po.name, atf.reason, ad.reason, v_pi.name) AS doc_title,
           coalesce(pr.estimated_total, po.total_amount, pinv.total_amount) AS doc_amount
    FROM workflow_instances wi
    JOIN workflow_steps ws
      ON ws.workflow_definition_id = wi.workflow_definition_id
     AND ws.step_no = wi.current_step_no
     AND ws.is_active = true
    LEFT JOIN users iu ON iu.id = wi.initiated_by
    LEFT JOIN purchase_requisitions pr ON wi.entity_type = 'purchase_requisition' AND pr.id = wi.entity_id
    LEFT JOIN purchase_orders po       ON wi.entity_type = 'purchase_order'       AND po.id = wi.entity_id
    LEFT JOIN vendors v_po             ON v_po.id = po.vendor_id
    LEFT JOIN asset_transfers atf      ON wi.entity_type = 'asset_transfer'       AND atf.id = wi.entity_id
    LEFT JOIN asset_disposals ad       ON wi.entity_type = 'asset_disposal'       AND ad.id = wi.entity_id
    LEFT JOIN purchase_invoices pinv   ON wi.entity_type = 'purchase_invoice'     AND pinv.id = wi.entity_id
    LEFT JOIN vendors v_pi             ON v_pi.id = pinv.vendor_id
    WHERE wi.tenant_id = v_ctx.tenant_id
      AND wi.is_active = true
      AND wi.status = 'in_progress'
      AND (p_entity_type IS NULL OR wi.entity_type = p_entity_type)
      AND (v_ctx.is_admin
           OR (ws.approver_type = 'user' AND ws.approver_user_id = v_ctx.caller_id)
           OR (ws.approver_type = 'role' AND ws.approver_role_id = ANY (v_ctx.role_ids))
           OR EXISTS (
                SELECT 1 FROM approval_delegations d
                WHERE d.tenant_id = v_ctx.tenant_id
                  AND d.to_user_id = v_ctx.caller_id
                  AND d.from_user_id = ws.approver_user_id
                  AND (d.entity_type IS NULL OR d.entity_type = wi.entity_type)
                  AND current_date BETWEEN d.from_date AND d.to_date
                  AND d.is_active = true));

    SELECT COUNT(*) INTO v_total FROM tmp_pending;

    SELECT jsonb_agg(to_jsonb(r)) INTO v_results
    FROM (
      SELECT * FROM tmp_pending
      ORDER BY initiated_at DESC
      LIMIT least(p_page_size, 200) OFFSET v_offset
    ) r;

    DROP TABLE IF EXISTS tmp_pending;

    RETURN fn_response_success(
      p_data          := coalesce(v_results, '[]'::jsonb),
      p_message       := 'Retrieved successfully',
      p_total_records := v_total,
      p_page_size     := p_page_size,
      p_page_index    := p_page_index
    );
  EXCEPTION WHEN OTHERS THEN
    DROP TABLE IF EXISTS tmp_pending;
    RETURN fn_response_error('fn_list_pending_approvals', SQLERRM, '[]'::jsonb, v_ctx.tenant_id, v_ctx.user_id);
  END;
END;
$function$;


-- ============================================================================
-- UI WRAPPERS — single jsonb payload (engine posts one JSON object)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_allocate_asset_ui(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN fn_allocate_asset(
    (p_payload->>'asset_id')::integer,
    (p_payload->>'user_id')::integer,
    nullif(p_payload->>'expected_return_date', '')::date,
    p_payload->>'remarks');
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_deallocate_asset_ui(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN fn_deallocate_asset(
    (p_payload->>'asset_id')::integer,
    nullif(p_payload->>'condition_id', '')::integer,
    p_payload->>'remarks');
END;
$function$;


CREATE OR REPLACE FUNCTION public.fn_action_workflow_step_ui(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN fn_action_workflow_step(
    (p_payload->>'workflow_instance_id')::integer,
    p_payload->>'action',
    p_payload->>'comments');
END;
$function$;


-- ============================================================================
-- GRANTS
-- ============================================================================

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'fn_save_goods_receipt(jsonb)',
    'fn_get_goods_receipt(integer)',
    'fn_list_goods_receipts(integer,integer,text,integer,text)',
    'fn_save_maintenance_work_order(jsonb)',
    'fn_get_maintenance_work_order(integer)',
    'fn_list_maintenance_work_orders(integer,integer,text,integer,integer)',
    'fn_list_pending_approvals(integer,integer,text)',
    'fn_allocate_asset_ui(jsonb)',
    'fn_deallocate_asset_ui(jsonb)',
    'fn_action_workflow_step_ui(jsonb)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- ============================================================================
-- END 06
-- ============================================================================
