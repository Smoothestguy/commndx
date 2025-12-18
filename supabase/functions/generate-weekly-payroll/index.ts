import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimeEntry {
  id: string;
  personnel_id: string;
  project_id: string;
  entry_date: string;
  regular_hours: number;
  overtime_hours: number;
  personnel: {
    id: string;
    first_name: string;
    last_name: string;
    hourly_rate: number | null;
    pay_rate: number | null; // Internal pay rate for payroll
  };
  project: {
    id: string;
    name: string;
  };
}

interface PersonnelProjectHours {
  personnelId: string;
  personnelName: string;
  payRate: number; // Use pay_rate for payroll calculations
  projectId: string;
  projectName: string;
  regularHours: number;
  overtimeHours: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body for optional date override
    let payPeriodEnd: Date;
    let payPeriodStart: Date;

    try {
      const body = await req.json();
      if (body.payPeriodEnd) {
        payPeriodEnd = new Date(body.payPeriodEnd);
      } else {
        // Default to last Sunday
        const today = new Date();
        const dayOfWeek = today.getDay();
        payPeriodEnd = new Date(today);
        payPeriodEnd.setDate(today.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
      }
    } catch {
      // Default to last Sunday if no body
      const today = new Date();
      const dayOfWeek = today.getDay();
      payPeriodEnd = new Date(today);
      payPeriodEnd.setDate(today.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
    }

    // Pay period is Mon-Sun
    payPeriodStart = new Date(payPeriodEnd);
    payPeriodStart.setDate(payPeriodEnd.getDate() - 6);

    const startDate = payPeriodStart.toISOString().split("T")[0];
    const endDate = payPeriodEnd.toISOString().split("T")[0];

    console.log(`Generating payroll for period: ${startDate} to ${endDate}`);

    // Check if payroll already generated for this period
    const { data: existingPayments } = await supabase
      .from("personnel_payments")
      .select("id")
      .eq("pay_period_start", startDate)
      .eq("pay_period_end", endDate)
      .limit(1);

    if (existingPayments && existingPayments.length > 0) {
      // Return 200 so the client can surface the message without treating it as a transport failure
      return new Response(
        JSON.stringify({
          success: false,
          message: `Payroll already generated for period ${startDate} to ${endDate}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings for overtime rules
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("overtime_multiplier, weekly_overtime_threshold")
      .single();

    const overtimeMultiplier = companySettings?.overtime_multiplier || 1.5;
    const weeklyOvertimeThreshold = companySettings?.weekly_overtime_threshold || 40;

    // Get the "Direct Labor" expense category
    const { data: laborCategory } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("name", "Direct Labor")
      .single();

    const laborCategoryId = laborCategory?.id;

    // Get the "Reimbursement" expense category
    const { data: reimbursementCategory } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("name", "Reimbursement")
      .single();

    const reimbursementCategoryId = reimbursementCategory?.id;

    // Fetch all time entries for the pay period
    const { data: timeEntries, error: entriesError } = await supabase
      .from("time_entries")
      .select(`
        id,
        personnel_id,
        project_id,
        entry_date,
        regular_hours,
        overtime_hours,
        personnel:personnel_id(id, first_name, last_name, hourly_rate, pay_rate),
        project:project_id(id, name)
      `)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .not("personnel_id", "is", null);

    if (entriesError) {
      console.error("Error fetching time entries:", entriesError);
      throw entriesError;
    }

    console.log(`Found ${timeEntries?.length || 0} time entries`);

    if (!timeEntries || timeEntries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No time entries found for this pay period",
          paymentsCreated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group hours by personnel and project
    const personnelProjectMap = new Map<string, PersonnelProjectHours>();
    const personnelTotalHours = new Map<string, number>();

    for (const entry of timeEntries as unknown as TimeEntry[]) {
      if (!entry.personnel || !entry.project) continue;

      const key = `${entry.personnel_id}-${entry.project_id}`;
      const personnelName = `${entry.personnel.first_name} ${entry.personnel.last_name}`;
      // Use pay_rate for payroll, fall back to hourly_rate for backwards compatibility
      const payRate = entry.personnel.pay_rate || entry.personnel.hourly_rate || 0;

      // Track total hours per personnel for overtime calculation
      const currentTotal = personnelTotalHours.get(entry.personnel_id) || 0;
      const entryHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
      personnelTotalHours.set(entry.personnel_id, currentTotal + entryHours);

      if (!personnelProjectMap.has(key)) {
        personnelProjectMap.set(key, {
          personnelId: entry.personnel_id,
          personnelName,
          payRate,
          projectId: entry.project_id,
          projectName: entry.project.name,
          regularHours: 0,
          overtimeHours: 0,
        });
      }

      const record = personnelProjectMap.get(key)!;
      record.regularHours += entry.regular_hours || 0;
      record.overtimeHours += entry.overtime_hours || 0;
    }

    // Group by personnel for payment creation
    const personnelPayments = new Map<string, {
      personnelId: string;
      personnelName: string;
      payRate: number;
      totalRegularHours: number;
      totalOvertimeHours: number;
      projects: Array<{
        projectId: string;
        projectName: string;
        regularHours: number;
        overtimeHours: number;
        amount: number;
      }>;
    }>();

    for (const [_, record] of personnelProjectMap) {
      if (!personnelPayments.has(record.personnelId)) {
        personnelPayments.set(record.personnelId, {
          personnelId: record.personnelId,
          personnelName: record.personnelName,
          payRate: record.payRate,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          projects: [],
        });
      }

      const payment = personnelPayments.get(record.personnelId)!;
      
      // Calculate pay for this project using pay_rate
      const regularPay = record.regularHours * record.payRate;
      const overtimePay = record.overtimeHours * record.payRate * overtimeMultiplier;
      const projectAmount = regularPay + overtimePay;

      payment.totalRegularHours += record.regularHours;
      payment.totalOvertimeHours += record.overtimeHours;
      payment.projects.push({
        projectId: record.projectId,
        projectName: record.projectName,
        regularHours: record.regularHours,
        overtimeHours: record.overtimeHours,
        amount: projectAmount,
      });
    }

    // Create payments and allocations
    let paymentsCreated = 0;
    const paymentDate = new Date();
    // Set to next Friday
    const dayOfWeek = paymentDate.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    paymentDate.setDate(paymentDate.getDate() + daysUntilFriday);
    const paymentDateStr = paymentDate.toISOString().split("T")[0];

    for (const [_, paymentData] of personnelPayments) {
      const grossAmount = paymentData.projects.reduce((sum, p) => sum + p.amount, 0);

      if (grossAmount <= 0) continue;

      // Create the personnel payment
      const { data: payment, error: paymentError } = await supabase
        .from("personnel_payments")
        .insert({
          personnel_id: paymentData.personnelId,
          personnel_name: paymentData.personnelName,
          payment_date: paymentDateStr,
          gross_amount: grossAmount,
          category_id: laborCategoryId,
          payment_type: "regular",
          pay_period_start: startDate,
          pay_period_end: endDate,
          regular_hours: paymentData.totalRegularHours,
          overtime_hours: paymentData.totalOvertimeHours,
          hourly_rate: paymentData.payRate, // Store pay_rate as hourly_rate in payment record
          notes: `Payroll for ${startDate} to ${endDate}`,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error creating payment:", paymentError);
        continue;
      }

      console.log(`Created payment ${payment.number} for ${paymentData.personnelName}`);

      // Create project allocations
      for (const project of paymentData.projects) {
        const { error: allocError } = await supabase
          .from("personnel_payment_allocations")
          .insert({
            payment_id: payment.id,
            project_id: project.projectId,
            amount: project.amount,
            notes: `${project.regularHours}h regular + ${project.overtimeHours}h OT on ${project.projectName}`,
          });

        if (allocError) {
          console.error("Error creating allocation:", allocError);
        }
      }

      // Find and include approved reimbursements for this personnel
      const { data: reimbursements, error: reimbError } = await supabase
        .from("reimbursements")
        .select("*")
        .eq("personnel_id", paymentData.personnelId)
        .eq("status", "approved")
        .is("payment_id", null);

      if (reimbError) {
        console.error("Error fetching reimbursements:", reimbError);
      }

      if (reimbursements && reimbursements.length > 0) {
        let totalReimbursement = 0;
        const reimbursementIds: string[] = [];

        for (const reimb of reimbursements) {
          totalReimbursement += reimb.amount;
          reimbursementIds.push(reimb.id);

          // Create project allocation for reimbursement if project is specified
          if (reimb.project_id) {
            const { error: reimbAllocError } = await supabase
              .from("personnel_payment_allocations")
              .insert({
                payment_id: payment.id,
                project_id: reimb.project_id,
                amount: reimb.amount,
                notes: `Reimbursement: ${reimb.description}`,
              });

            if (reimbAllocError) {
              console.error("Error creating reimbursement allocation:", reimbAllocError);
            }
          }
        }

        // Link reimbursements to this payment
        const { error: linkError } = await supabase
          .from("reimbursements")
          .update({ payment_id: payment.id })
          .in("id", reimbursementIds);

        if (linkError) {
          console.error("Error linking reimbursements:", linkError);
        }

        // Update payment gross amount to include reimbursements
        const { error: updateError } = await supabase
          .from("personnel_payments")
          .update({ 
            gross_amount: grossAmount + totalReimbursement,
            notes: `Payroll for ${startDate} to ${endDate} (includes $${totalReimbursement.toFixed(2)} reimbursements)`,
          })
          .eq("id", payment.id);

        if (updateError) {
          console.error("Error updating payment with reimbursements:", updateError);
        }

        console.log(`Added ${reimbursements.length} reimbursements ($${totalReimbursement.toFixed(2)}) to payment`);
      }

      paymentsCreated++;
    }

    console.log(`Payroll generation complete. Created ${paymentsCreated} payments.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Payroll generated for ${startDate} to ${endDate}`,
        paymentsCreated,
        payPeriod: { start: startDate, end: endDate },
        paymentDate: paymentDateStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating payroll:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
