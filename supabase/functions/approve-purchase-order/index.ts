import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovePORequest {
  purchaseOrderId: string;
  approved: boolean; // true = approve, false = reject
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role client for all operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User auth error:', userError);
      throw new Error('Unauthorized');
    }

    // Check if user is admin or manager
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['admin', 'manager'].includes(userRole.role)) {
      throw new Error('Insufficient permissions. Only admins and managers can approve purchase orders.');
    }

    const { purchaseOrderId, approved }: ApprovePORequest = await req.json();

    console.log(`Processing PO ${approved ? 'approval' : 'rejection'} for PO: ${purchaseOrderId} by user: ${user.id}`);

    // Fetch the purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', purchaseOrderId)
      .single();

    if (poError || !po) {
      throw new Error('Purchase order not found');
    }

    // Check if PO is in pending_approval status
    if (po.status !== 'pending_approval') {
      throw new Error(`Purchase order is not pending approval. Current status: ${po.status}`);
    }

    // Update the purchase order
    const updateData: any = {
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    };

    if (approved) {
      // Approve: change status to draft (ready to send)
      updateData.status = 'draft';
    } else {
      // Reject: change status to cancelled
      updateData.status = 'cancelled';
    }

    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', purchaseOrderId);

    if (updateError) {
      console.error('Error updating purchase order:', updateError);
      throw new Error('Failed to update purchase order');
    }

    console.log(`Purchase order ${approved ? 'approved' : 'rejected'} successfully`);

    // Trigger notification about the status change
    try {
      await supabase.functions.invoke('notify-po-status-change', {
        body: {
          purchaseOrderId,
          newStatus: updateData.status,
          oldStatus: 'pending_approval',
        },
      });
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
      // Don't fail the approval if notification fails
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Purchase order ${approved ? 'approved' : 'rejected'} successfully`,
      newStatus: updateData.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in approve-purchase-order function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
};

serve(handler);