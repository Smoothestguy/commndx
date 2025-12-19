import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EditRequestPayload {
  applicationId: string;
  missingFields: string[];
  adminMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicationId, missingFields, adminMessage }: EditRequestPayload = await req.json();

    console.log("[Edit Request] Received request for application:", applicationId);
    console.log("[Edit Request] Missing fields:", missingFields);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the application with applicant data
    const { data: application, error: fetchError } = await supabase
      .from("applications")
      .select(`
        *,
        applicants (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        job_postings (
          public_token,
          project_task_orders (
            title,
            projects:project_id (name)
          )
        )
      `)
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      console.error("[Edit Request] Error fetching application:", fetchError);
      throw new Error("Application not found");
    }

    const applicant = application.applicants;
    if (!applicant?.email) {
      throw new Error("Applicant email not found");
    }

    // Generate a secure edit token
    const editToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days expiry

    // Update application with edit token and status
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: "needs_info",
        edit_token: editToken,
        edit_token_expires_at: expiresAt.toISOString(),
        missing_fields: missingFields,
        admin_message: adminMessage || null,
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error("[Edit Request] Error updating application:", updateError);
      throw updateError;
    }

    console.log("[Edit Request] Application updated with edit token");

    // Build edit URL - ensure clean URL without whitespace
    const siteUrl = (Deno.env.get("SITE_URL") || "https://your-app.lovable.app").trim();
    const editUrl = encodeURI(`${siteUrl}/apply/edit/${editToken}`);

    console.log("[Edit Request] Generated edit URL:", editUrl);

    // Get position info
    const positionTitle = application.job_postings?.project_task_orders?.title || "the position";
    const projectName = application.job_postings?.project_task_orders?.projects?.name || "";

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Applications <noreply@fairfieldrg.com>",
      to: [applicant.email],
      subject: "Action Required: Please Update Your Application",
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Action Required</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Hi ${applicant.first_name},</p>
    
    <p>We're reviewing your application for <strong>${positionTitle}</strong>${projectName ? ` at ${projectName}` : ""} and need some additional information to proceed.</p>
    
    ${adminMessage ? `<div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-style: italic;">"${adminMessage}"</p>
    </div>` : ""}
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #1e40af;">Please update the following:</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${missingFields.map(field => `<li style="margin-bottom: 8px;">${field}</li>`).join("")}
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${editUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Update My Application</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">This link will expire in 14 days. Your previous responses are saved and will be pre-filled.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${editUrl}" target="_blank" rel="noopener noreferrer" style="color: #f97316; word-break: break-all;">${editUrl}</a>
    </p>
  </div>
</body>
</html>`,
    });

    // Check if email sending failed
    if (emailResponse.error) {
      console.error("[Edit Request] Email failed to send:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to send email", 
          emailError: emailResponse.error.message,
          editToken,
          applicationUpdated: true
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[Edit Request] Email sent successfully:", emailResponse.data);

    return new Response(
      JSON.stringify({ success: true, editToken }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Edit Request] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
