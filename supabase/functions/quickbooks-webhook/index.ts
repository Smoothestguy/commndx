import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, intuit-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QB_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
const QB_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;
const WEBHOOK_VERIFIER_TOKEN = Deno.env.get("QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN")!;

interface WebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: Array<{
        name: string;
        id: string;
        operation: "Create" | "Update" | "Delete" | "Merge" | "Void";
        lastUpdated: string;
      }>;
    };
  }>;
}

// Verify the webhook signature from QuickBooks
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(WEBHOOK_VERIFIER_TOKEN),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    );
    
    const expectedSignature = encode(signatureBuffer);
    return signature === expectedSignature;
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

// Get valid QuickBooks access token
async function getValidToken(supabase: any) {
  const { data: config, error } = await supabase
    .from("quickbooks_config")
    .select("*")
    .single();

  if (error || !config) {
    throw new Error("QuickBooks not connected");
  }

  const now = new Date();
  const tokenExpiry = new Date(config.token_expires_at);

  if (now >= tokenExpiry) {
    console.log("[Webhook] Token expired, refreshing...");
    const refreshResponse = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = await refreshResponse.json();
    const newExpiry = new Date(now.getTime() + tokens.expires_in * 1000);

    await supabase
      .from("quickbooks_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return { accessToken: tokens.access_token, realmId: config.realm_id };
  }

  return { accessToken: config.access_token, realmId: config.realm_id };
}

// Fetch estimate from QuickBooks
async function fetchQBEstimate(estimateId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/estimate/${estimateId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB estimate: ${errorText}`);
  }

  const data = await response.json();
  return data.Estimate;
}

// Fetch bill from QuickBooks
async function fetchQBBill(billId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/bill/${billId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB bill: ${errorText}`);
  }

  const data = await response.json();
  return data.Bill;
}

// Fetch invoice from QuickBooks
async function fetchQBInvoice(invoiceId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice/${invoiceId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB invoice: ${errorText}`);
  }

  const data = await response.json();
  return data.Invoice;
}

// Fetch customer from QuickBooks
async function fetchQBCustomer(customerId: string, accessToken: string, realmId: string) {
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/customer/${customerId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QB customer: ${errorText}`);
  }

  const data = await response.json();
  return data.Customer;
}

// Map QB estimate status to local status
function mapQbStatusToLocal(txnStatus: string | undefined): string {
  switch (txnStatus) {
    case "Accepted":
      return "approved";
    case "Closed":
      return "closed";
    case "Rejected":
      return "rejected";
    case "Pending":
    default:
      return "sent";
  }
}

// Map QB bill balance to local status
function mapQbBillStatusToLocal(balance: number, totalAmt: number): string {
  if (balance === 0 && totalAmt > 0) {
    return "paid";
  } else if (balance < totalAmt && balance > 0) {
    return "partially_paid";
  }
  return "open";
}

// Map QB invoice balance to local status
function mapQbInvoiceStatusToLocal(balance: number, totalAmt: number, dueDate?: string): string {
  if (balance === 0 && totalAmt > 0) {
    return "paid";
  } else if (balance < totalAmt && balance > 0) {
    return "partially_paid";
  }
  // Check if overdue (past due date and still has balance)
  if (dueDate && balance > 0) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) {
      return "overdue";
    }
  }
  return "sent";
}

// Process a single customer update from QuickBooks
async function processCustomerUpdate(
  supabase: any,
  qbCustomerId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing customer ${qbCustomerId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_customer_mappings")
    .select("*, customers:customer_id(*)")
    .eq("quickbooks_customer_id", qbCustomerId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding customer mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  // Handle Delete/Void operations
  if (operation === "Delete" || operation === "Void") {
    if (!mapping) {
      console.log("[Webhook] No local mapping found for deleted QB customer:", qbCustomerId);
      return { success: true, skipped: true, reason: "No local mapping" };
    }

    // Soft-delete the local customer
    const { error: deleteError } = await supabase
      .from("customers")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", mapping.customer_id);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting customer:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update mapping status
    await supabase
      .from("quickbooks_customer_mappings")
      .update({
        sync_status: "deleted",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "customer",
      entity_id: mapping.customer_id,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_customer_id: qbCustomerId,
        operation,
      },
    });

    console.log("[Webhook] Soft-deleted customer from QB webhook:", mapping.customer_id);
    return { success: true, action: "deleted", customerId: mapping.customer_id };
  }

  // Fetch the full customer from QuickBooks
  const qbCustomer = await fetchQBCustomer(qbCustomerId, accessToken, realmId);
  console.log("[Webhook] Fetched QB customer:", qbCustomer.DisplayName);

  // Build address from QB BillAddr
  let address = null;
  if (qbCustomer.BillAddr) {
    const addr = qbCustomer.BillAddr;
    const parts = [
      addr.Line1,
      addr.Line2,
      addr.City,
      addr.CountrySubDivisionCode,
      addr.PostalCode,
    ].filter(Boolean);
    address = parts.join(", ");
  }

  // Determine customer type from QB Job field
  const customerType = qbCustomer.Job ? "commercial" : "residential";

  // Extract email - use fallback if not provided
  let email = qbCustomer.PrimaryEmailAddr?.Address;
  if (!email) {
    email = `qb-${qbCustomerId}@quickbooks.imported`;
  }

  if (!mapping) {
    // No local mapping exists - create new customer in Command X
    console.log("[Webhook] Creating new customer from QuickBooks:", qbCustomer.DisplayName);

    // Check if email already exists (to prevent duplicates)
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, email")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCustomer) {
      console.log("[Webhook] Customer with this email already exists, creating mapping only");
      
      // Just create mapping to existing customer
      await supabase.from("quickbooks_customer_mappings").insert({
        customer_id: existingCustomer.id,
        quickbooks_customer_id: qbCustomerId,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      });

      return { success: true, action: "mapped_existing", customerId: existingCustomer.id };
    }

    // Create new customer
    const { data: newCustomer, error: insertError } = await supabase
      .from("customers")
      .insert({
        name: qbCustomer.DisplayName,
        email: email,
        phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
        company: qbCustomer.CompanyName || null,
        address: address,
        notes: qbCustomer.Notes || null,
        customer_type: customerType,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Webhook] Error creating customer:", insertError);
      return { success: false, error: insertError.message };
    }

    // Create the mapping
    await supabase.from("quickbooks_customer_mappings").insert({
      customer_id: newCustomer.id,
      quickbooks_customer_id: qbCustomerId,
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    });

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "customer",
      entity_id: newCustomer.id,
      action: "webhook_create",
      status: "success",
      details: {
        qb_customer_id: qbCustomerId,
        qb_display_name: qbCustomer.DisplayName,
        operation,
      },
    });

    console.log("[Webhook] Created new customer from QB:", newCustomer.id);
    return { success: true, action: "created", customerId: newCustomer.id };
  }

  // Mapping exists - check for conflict detection
  const qbLastUpdated = new Date(qbCustomer.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer than our last sync
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB customer is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local customer
  const customerUpdate = {
    name: qbCustomer.DisplayName,
    phone: qbCustomer.PrimaryPhone?.FreeFormNumber || mapping.customers?.phone,
    company: qbCustomer.CompanyName || mapping.customers?.company,
    address: address || mapping.customers?.address,
    notes: qbCustomer.Notes || mapping.customers?.notes,
    customer_type: customerType,
    updated_at: new Date().toISOString(),
  };

  // Only update email if it's a real email (not the placeholder)
  if (qbCustomer.PrimaryEmailAddr?.Address) {
    (customerUpdate as any).email = qbCustomer.PrimaryEmailAddr.Address;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update(customerUpdate)
    .eq("id", mapping.customer_id);

  if (updateError) {
    console.error("[Webhook] Error updating customer:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update the mapping
  await supabase
    .from("quickbooks_customer_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "customer",
    entity_id: mapping.customer_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_customer_id: qbCustomerId,
      qb_display_name: qbCustomer.DisplayName,
      operation,
      fields_updated: Object.keys(customerUpdate),
    },
  });

  console.log("[Webhook] Successfully updated customer from QB:", mapping.customer_id);
  return { success: true, action: "updated", customerId: mapping.customer_id };
}

// Process a single estimate update from QuickBooks
async function processEstimateUpdate(
  supabase: any,
  qbEstimateId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing estimate ${qbEstimateId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_estimate_mappings")
    .select("*, estimates(*)")
    .eq("quickbooks_estimate_id", qbEstimateId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB estimate:", qbEstimateId);
    // This estimate exists in QB but not in Command X - could trigger an import
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Mark the local estimate as voided/deleted
    await supabase
      .from("quickbooks_estimate_mappings")
      .update({
        sync_status: "voided",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    console.log("[Webhook] Marked estimate as voided:", mapping.estimate_id);
    return { success: true, action: "voided" };
  }

  // Fetch the full estimate from QuickBooks
  const qbEstimate = await fetchQBEstimate(qbEstimateId, accessToken, realmId);
  console.log("[Webhook] Fetched QB estimate:", qbEstimate.DocNumber);

  // Get QB last updated time
  const qbLastUpdated = new Date(qbEstimate.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB estimate is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Update the local estimate
  const estimateUpdate = {
    notes: qbEstimate.CustomerMemo?.value || null,
    status: mapQbStatusToLocal(qbEstimate.TxnStatus),
    subtotal: parseFloat(qbEstimate.TotalAmt || "0") - parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    tax_amount: parseFloat(qbEstimate.TxnTaxDetail?.TotalTax || "0"),
    total: parseFloat(qbEstimate.TotalAmt || "0"),
    valid_until: qbEstimate.ExpirationDate || mapping.estimates?.valid_until,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("estimates")
    .update(estimateUpdate)
    .eq("id", mapping.estimate_id);

  if (updateError) {
    console.error("[Webhook] Error updating estimate:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("estimate_line_items")
    .delete()
    .eq("estimate_id", mapping.estimate_id);

  if (qbEstimate.Line && qbEstimate.Line.length > 0) {
    const lineItems = [];
    let sortOrder = 0;

    for (const line of qbEstimate.Line) {
      if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
        const detail = line.SalesItemLineDetail;
        
        // Try to find matching product by QB item ID
        let productId = null;
        if (detail.ItemRef?.value) {
          const { data: productMapping } = await supabase
            .from("quickbooks_product_mappings")
            .select("product_id")
            .eq("quickbooks_item_id", detail.ItemRef.value)
            .maybeSingle();
          
          if (productMapping) {
            productId = productMapping.product_id;
          }
        }

        lineItems.push({
          estimate_id: mapping.estimate_id,
          product_id: productId,
          product_name: detail.ItemRef?.name || null,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_price: parseFloat(detail.UnitPrice || "0"),
          markup: 0,
          total: parseFloat(line.Amount || "0"),
          sort_order: sortOrder++,
          is_taxable: detail.TaxCodeRef?.value === "TAX",
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("estimate_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting line items:", lineError);
      }
    }
  }

  // Update the mapping
  await supabase
    .from("quickbooks_estimate_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "estimate",
    entity_id: mapping.estimate_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_estimate_id: qbEstimateId,
      qb_doc_number: qbEstimate.DocNumber,
      operation,
    },
  });

  console.log("[Webhook] Successfully updated estimate from QB:", mapping.estimate_id);
  return { success: true, action: "updated", estimateId: mapping.estimate_id };
}

// Process a single invoice update from QuickBooks (primarily for deletion sync)
async function processInvoiceUpdate(
  supabase: any,
  qbInvoiceId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing invoice ${qbInvoiceId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_invoice_mappings")
    .select("*, invoices:invoice_id(*)")
    .eq("quickbooks_invoice_id", qbInvoiceId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding invoice mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB invoice:", qbInvoiceId);
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Soft-delete the local invoice (set deleted_at)
    const { error: deleteError } = await supabase
      .from("invoices")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", mapping.invoice_id);

    if (deleteError) {
      console.error("[Webhook] Error soft-deleting invoice:", deleteError);
      return { success: false, error: deleteError.message };
    }

    // Update mapping to reflect deleted status
    await supabase
      .from("quickbooks_invoice_mappings")
      .update({
        sync_status: "deleted",
        synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    // Log the sync
    await supabase.from("quickbooks_sync_log").insert({
      entity_type: "invoice",
      entity_id: mapping.invoice_id,
      action: "webhook_delete",
      status: "success",
      details: {
        qb_invoice_id: qbInvoiceId,
        qb_doc_number: mapping.quickbooks_doc_number,
        operation,
      },
    });

    console.log("[Webhook] Soft-deleted invoice from QB webhook:", mapping.invoice_id);
    return { success: true, action: "deleted", invoiceId: mapping.invoice_id };
  }

  // For Create/Update operations - sync changes from QuickBooks
  console.log("[Webhook] Processing invoice create/update from QuickBooks");

  // Fetch the full invoice from QuickBooks
  const qbInvoice = await fetchQBInvoice(qbInvoiceId, accessToken, realmId);
  console.log("[Webhook] Fetched QB invoice:", qbInvoice.DocNumber);

  // Get QB last updated time for conflict detection
  const qbLastUpdated = new Date(qbInvoice.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.synced_at ? new Date(mapping.synced_at) : null;

  // Check if QB is actually newer than our last sync
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB invoice is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Calculate amounts from QB invoice
  const totalAmt = parseFloat(qbInvoice.TotalAmt || "0");
  const balance = parseFloat(qbInvoice.Balance || "0");
  const taxAmount = parseFloat(qbInvoice.TxnTaxDetail?.TotalTax || "0");
  const subtotal = totalAmt - taxAmount;
  const paidAmount = totalAmt - balance;

  // Update the local invoice
  const invoiceUpdate = {
    due_date: qbInvoice.DueDate || mapping.invoices?.due_date,
    notes: qbInvoice.PrivateNote || null,
    subtotal: subtotal,
    tax_amount: taxAmount,
    total: totalAmt,
    paid_amount: paidAmount,
    remaining_amount: balance,
    status: mapQbInvoiceStatusToLocal(balance, totalAmt, qbInvoice.DueDate),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("invoices")
    .update(invoiceUpdate)
    .eq("id", mapping.invoice_id);

  if (updateError) {
    console.error("[Webhook] Error updating invoice:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", mapping.invoice_id);

  if (qbInvoice.Line && qbInvoice.Line.length > 0) {
    const lineItems = [];
    let displayOrder = 0;

    for (const line of qbInvoice.Line) {
      if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
        const detail = line.SalesItemLineDetail;
        
        // Try to find matching product by QB item ID
        let productId = null;
        let productName = detail.ItemRef?.name || null;
        
        if (detail.ItemRef?.value) {
          const { data: productMapping } = await supabase
            .from("quickbooks_product_mappings")
            .select("product_id, products(name)")
            .eq("quickbooks_item_id", detail.ItemRef.value)
            .maybeSingle();
          
          if (productMapping) {
            productId = productMapping.product_id;
            // Use local product name if we have a mapping
            if (productMapping.products?.name) {
              productName = productMapping.products.name;
            }
          }
        }

        lineItems.push({
          invoice_id: mapping.invoice_id,
          product_id: productId,
          product_name: productName,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_price: parseFloat(detail.UnitPrice || "0"),
          markup: 0,
          total: parseFloat(line.Amount || "0"),
          display_order: displayOrder++,
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("invoice_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting invoice line items:", lineError);
      }
    }
  }

  // Update the mapping with new sync timestamp
  await supabase
    .from("quickbooks_invoice_mappings")
    .update({
      synced_at: new Date().toISOString(),
      sync_status: "synced",
      quickbooks_doc_number: qbInvoice.DocNumber,
    })
    .eq("id", mapping.id);

  // Log the sync action
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "invoice",
    entity_id: mapping.invoice_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbInvoice.DocNumber,
      operation,
      fields_updated: ["due_date", "notes", "subtotal", "tax_amount", "total", "paid_amount", "remaining_amount", "status", "line_items"],
    },
  });

  console.log("[Webhook] Successfully updated invoice from QB:", mapping.invoice_id);
  return { success: true, action: "updated", invoiceId: mapping.invoice_id };
}

// Process a single bill update from QuickBooks
async function processBillUpdate(
  supabase: any,
  qbBillId: string,
  operation: string,
  accessToken: string,
  realmId: string
) {
  console.log(`[Webhook] Processing bill ${qbBillId}, operation: ${operation}`);

  // Find the local mapping
  const { data: mapping, error: mappingError } = await supabase
    .from("quickbooks_bill_mappings")
    .select("*, vendor_bills:bill_id(*)")
    .eq("quickbooks_bill_id", qbBillId)
    .maybeSingle();

  if (mappingError) {
    console.error("[Webhook] Error finding bill mapping:", mappingError);
    return { success: false, error: mappingError.message };
  }

  if (!mapping) {
    console.log("[Webhook] No local mapping found for QB bill:", qbBillId);
    // This bill exists in QB but not in Command X - could trigger an import
    return { success: true, skipped: true, reason: "No local mapping" };
  }

  if (operation === "Delete" || operation === "Void") {
    // Mark the local mapping as voided
    await supabase
      .from("quickbooks_bill_mappings")
      .update({
        sync_status: "voided",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", mapping.id);

    console.log("[Webhook] Marked bill as voided:", mapping.bill_id);
    return { success: true, action: "voided" };
  }

  // Fetch the full bill from QuickBooks
  const qbBill = await fetchQBBill(qbBillId, accessToken, realmId);
  console.log("[Webhook] Fetched QB bill:", qbBill.DocNumber);

  // Get QB last updated time
  const qbLastUpdated = new Date(qbBill.MetaData.LastUpdatedTime);
  const localLastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at) : null;

  // Check if QB is actually newer
  if (localLastSynced && qbLastUpdated <= localLastSynced) {
    console.log("[Webhook] QB bill is not newer than local, skipping");
    return { success: true, skipped: true, reason: "Local is up to date" };
  }

  // Calculate totals from QB bill
  const totalAmt = parseFloat(qbBill.TotalAmt || "0");
  const balance = parseFloat(qbBill.Balance || "0");

  // Update the local vendor bill
  const billUpdate = {
    notes: qbBill.PrivateNote || null,
    bill_date: qbBill.TxnDate || mapping.vendor_bills?.bill_date,
    due_date: qbBill.DueDate || mapping.vendor_bills?.due_date,
    subtotal: totalAmt, // QB bills typically don't have separate tax
    total: totalAmt,
    remaining_amount: balance,
    paid_amount: totalAmt - balance,
    status: mapQbBillStatusToLocal(balance, totalAmt),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("vendor_bills")
    .update(billUpdate)
    .eq("id", mapping.bill_id);

  if (updateError) {
    console.error("[Webhook] Error updating vendor bill:", updateError);
    return { success: false, error: updateError.message };
  }

  // Update line items - delete existing and insert new
  await supabase
    .from("vendor_bill_line_items")
    .delete()
    .eq("bill_id", mapping.bill_id);

  if (qbBill.Line && qbBill.Line.length > 0) {
    const lineItems = [];

    for (const line of qbBill.Line) {
      // Handle AccountBasedExpenseLineDetail (most common for bills)
      if (line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail) {
        const detail = line.AccountBasedExpenseLineDetail;
        
        // Try to find matching expense category by account name
        let categoryId = null;
        if (detail.AccountRef?.name) {
          const { data: category } = await supabase
            .from("expense_categories")
            .select("id")
            .ilike("name", detail.AccountRef.name)
            .maybeSingle();
          
          if (category) {
            categoryId = category.id;
          }
        }

        lineItems.push({
          bill_id: mapping.bill_id,
          description: line.Description || detail.AccountRef?.name || "Expense",
          quantity: 1,
          unit_cost: parseFloat(line.Amount || "0"),
          total: parseFloat(line.Amount || "0"),
          category_id: categoryId,
        });
      }
      // Handle ItemBasedExpenseLineDetail (items/products)
      else if (line.DetailType === "ItemBasedExpenseLineDetail" && line.ItemBasedExpenseLineDetail) {
        const detail = line.ItemBasedExpenseLineDetail;
        
        lineItems.push({
          bill_id: mapping.bill_id,
          description: line.Description || detail.ItemRef?.name || "Item",
          quantity: detail.Qty || 1,
          unit_cost: parseFloat(detail.UnitPrice || line.Amount || "0"),
          total: parseFloat(line.Amount || "0"),
        });
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from("vendor_bill_line_items")
        .insert(lineItems);

      if (lineError) {
        console.error("[Webhook] Error inserting bill line items:", lineError);
      }
    }
  }

  // Update the mapping
  await supabase
    .from("quickbooks_bill_mappings")
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: "synced",
      quickbooks_doc_number: qbBill.DocNumber,
    })
    .eq("id", mapping.id);

  // Log the sync
  await supabase.from("quickbooks_sync_log").insert({
    entity_type: "vendor_bill",
    entity_id: mapping.bill_id,
    action: "webhook_update",
    status: "success",
    details: {
      qb_bill_id: qbBillId,
      qb_doc_number: qbBill.DocNumber,
      operation,
    },
  });

  console.log("[Webhook] Successfully updated vendor bill from QB:", mapping.bill_id);
  return { success: true, action: "updated", billId: mapping.bill_id };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // QuickBooks sends a challenge for webhook verification during setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      console.log("[Webhook] Responding to challenge verification");
      return new Response(challenge, {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get("intuit-signature");

    console.log("[Webhook] Received webhook, signature present:", !!signature);

    // Verify signature
    if (!signature || !await verifySignature(payload, signature)) {
      console.error("[Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const webhookData: WebhookPayload = JSON.parse(payload);
    console.log("[Webhook] Payload parsed, notifications:", webhookData.eventNotifications?.length);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get valid token for API calls
    const { accessToken, realmId } = await getValidToken(supabase);

    const results = [];

    // Process each notification
    for (const notification of webhookData.eventNotifications || []) {
      // Verify realm ID matches our connected account
      if (notification.realmId !== realmId) {
        console.log("[Webhook] Realm ID mismatch, skipping");
        continue;
      }

      for (const entity of notification.dataChangeEvent?.entities || []) {
        if (entity.name === "Estimate") {
          const result = await processEstimateUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Estimate", ...result });
        } else if (entity.name === "Bill") {
          const result = await processBillUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Bill", ...result });
        } else if (entity.name === "Invoice") {
          const result = await processInvoiceUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Invoice", ...result });
        } else if (entity.name === "Customer") {
          const result = await processCustomerUpdate(
            supabase,
            entity.id,
            entity.operation,
            accessToken,
            realmId
          );
          results.push({ entityId: entity.id, entityType: "Customer", ...result });
        } else {
          console.log(`[Webhook] Skipping unsupported entity type: ${entity.name}`);
        }
      }
    }

    console.log("[Webhook] Processing complete, results:", results.length);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Still return 200 to prevent QuickBooks from retrying
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
