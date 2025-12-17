import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyPOStatusChangeRequest {
  purchaseOrderId: string;
  newStatus: string;
  oldStatus?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { purchaseOrderId, newStatus, oldStatus }: NotifyPOStatusChangeRequest = await req.json();

    console.log(`Processing PO status change notification for PO: ${purchaseOrderId}, status: ${oldStatus} -> ${newStatus}`);

    // Fetch purchase order details
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        po_line_items (*)
      `)
      .eq('id', purchaseOrderId)
      .single();

    if (poError || !po) {
      console.error('Error fetching purchase order:', poError);
      throw new Error('Purchase order not found');
    }

    // Fetch the user who submitted the PO
    const { data: submitter } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', po.submitted_by)
      .maybeSingle();

    // Fetch all admins and managers with their profiles
    const { data: teamMembers } = await supabase
      .from('user_roles')
      .select('user_id, profiles!user_roles_user_id_fkey(email, first_name, last_name)')
      .in('role', ['admin', 'manager']);

    if (!teamMembers || teamMembers.length === 0) {
      console.log('No team members to notify');
      return new Response(JSON.stringify({ message: 'No team members to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Determine notification event based on status
    let eventType = 'po_status_changed';
    if (newStatus === 'pending_approval') {
      eventType = 'po_submitted_for_approval';
    } else if (newStatus === 'draft' && oldStatus === 'pending_approval') {
      eventType = 'po_approved';
    } else if (newStatus === 'sent') {
      eventType = 'po_sent';
    } else if (newStatus === 'cancelled' && oldStatus === 'pending_approval') {
      eventType = 'po_rejected';
    }

    // Fetch notification preferences for all team members
    const userIds = teamMembers.map(m => m.user_id);
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', userIds);

    // Filter team members who want this notification
    const recipientsToNotify: string[] = [];
    
    for (const member of teamMembers) {
      const userPrefs = preferences?.find(p => p.user_id === member.user_id);
      
      // Check if user wants this type of notification
      const shouldNotify = userPrefs?.[eventType] !== false; // Default to true if not set
      
      // Access profiles as an object (one-to-one relationship)
      const profile = member.profiles as any;
      if (shouldNotify && profile?.email) {
        recipientsToNotify.push(profile.email);
      }
    }

    // If approved or rejected, notify the submitter
    if ((eventType === 'po_approved' || eventType === 'po_rejected') && submitter?.email) {
      const submitterPrefs = preferences?.find(p => p.user_id === po.submitted_by);
      const shouldNotify = submitterPrefs?.[eventType] !== false;
      if (shouldNotify) {
        recipientsToNotify.push(submitter.email);
      }
    }

    if (recipientsToNotify.length === 0) {
      console.log('No recipients want this notification based on their preferences');
      return new Response(JSON.stringify({ message: 'No recipients to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Build email subject and content based on event type
    let subject = '';
    let statusLabel = newStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    switch (eventType) {
      case 'po_submitted_for_approval':
        subject = `Purchase Order ${po.number} Requires Approval`;
        break;
      case 'po_approved':
        subject = `Purchase Order ${po.number} Has Been Approved`;
        break;
      case 'po_rejected':
        subject = `Purchase Order ${po.number} Has Been Rejected`;
        break;
      case 'po_sent':
        subject = `Purchase Order ${po.number} Has Been Sent to Vendor`;
        break;
      default:
        subject = `Purchase Order ${po.number} Status: ${statusLabel}`;
    }

    // Build HTML email body
    const lineItemsHtml = po.po_line_items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.unit_price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">${subject}</h2>
        
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #374151;">Purchase Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>PO Number:</strong></td>
              <td style="padding: 8px 0;">${po.number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Vendor:</strong></td>
              <td style="padding: 8px 0;">${po.vendor_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Project:</strong></td>
              <td style="padding: 8px 0;">${po.project_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Customer:</strong></td>
              <td style="padding: 8px 0;">${po.customer_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Status:</strong></td>
              <td style="padding: 8px 0; color: #8b5cf6; font-weight: bold;">${statusLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
              <td style="padding: 8px 0;"><strong>$${po.total.toFixed(2)}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Due Date:</strong></td>
              <td style="padding: 8px 0;">${new Date(po.due_date).toLocaleDateString()}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #374151;">Line Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Description</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #d1d5db;">Qty</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #d1d5db;">Unit Price</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #d1d5db;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        ${po.notes ? `
          <div style="background-color: #fef3c7; padding: 12px; border-radius: 4px; margin: 16px 0;">
            <strong>Notes:</strong>
            <p style="margin: 8px 0 0 0;">${po.notes}</p>
          </div>
        ` : ''}

        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          This is an automated notification from your Purchase Order Management System.
        </p>
      </div>
    `;

    // Send email to all recipients
    const emailResponse = await resend.emails.send({
      from: 'Fairfield <admin@fairfieldrg.com>',
      to: recipientsToNotify,
      subject: subject,
      html: htmlBody,
    });

    console.log('Notification email sent successfully:', emailResponse);

    // Create in-app notifications for admins/managers
    if (eventType === 'po_submitted_for_approval') {
      const inAppNotifications = userIds.map((userId: string) => ({
        user_id: userId,
        title: `${po.number} Requires Approval`,
        message: `Vendor: ${po.vendor_name} • $${po.total.toFixed(2)}`,
        notification_type: 'po_approval',
        link_url: `/purchase-orders/${po.id}`,
        related_id: po.id,
        is_read: false,
        metadata: {
          po_number: po.number,
          vendor_name: po.vendor_name,
          total: po.total,
        },
      }));

      const { error: notifError } = await supabase
        .from('admin_notifications')
        .insert(inAppNotifications);

      if (notifError) {
        console.error('Error creating in-app notifications:', notifError);
      } else {
        console.log(`Created ${inAppNotifications.length} in-app notifications`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      recipientCount: recipientsToNotify.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in notify-po-status-change function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};

serve(handler);