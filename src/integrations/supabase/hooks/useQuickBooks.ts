import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface QuickBooksConfig {
  id: string;
  realm_id: string | null;
  company_name: string | null;
  is_connected: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickBooksProductMapping {
  id: string;
  product_id: string;
  quickbooks_item_id: string;
  sync_status: 'synced' | 'pending' | 'conflict' | 'error';
  last_synced_at: string | null;
  sync_direction: string;
  conflict_data: {
    commandx_price?: number;
    quickbooks_price?: number;
    quickbooks_name?: string;
  } | null;
}

export interface QuickBooksSyncLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  quickbooks_id: string | null;
  action: string;
  status: string;
  error_message: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// Get QuickBooks config
export const useQuickBooksConfig = () => {
  return useQuery({
    queryKey: ["quickbooks-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_config")
        .select("id, realm_id, company_name, is_connected, last_sync_at, created_at, updated_at")
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as QuickBooksConfig | null;
    },
  });
};

// Get product mappings
export const useQuickBooksProductMappings = () => {
  return useQuery({
    queryKey: ["quickbooks-product-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_product_mappings")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as QuickBooksProductMapping[];
    },
  });
};

// Get sync logs
export const useQuickBooksSyncLogs = (limit = 50) => {
  return useQuery({
    queryKey: ["quickbooks-sync-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as QuickBooksSyncLog[];
    },
  });
};

// Get conflicts
export const useQuickBooksConflicts = () => {
  return useQuery({
    queryKey: ["quickbooks-conflicts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_product_mappings")
        .select(`
          *,
          products(id, name, price, sku)
        `)
        .eq("sync_status", "conflict");

      if (error) throw error;
      return data;
    },
  });
};

// OAuth actions
export const useQuickBooksConnect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, realmId, redirectUri }: { code: string; realmId: string; redirectUri: string }) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth', {
        body: { action: 'exchange-code', code, realmId, redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-config"] });
      toast.success(`Connected to ${data.companyName}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect: ${error.message}`);
    },
  });
};

export const useQuickBooksDisconnect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-config"] });
      toast.success("Disconnected from QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });
};

export const useGetQuickBooksAuthUrl = () => {
  return useMutation({
    mutationFn: async (redirectUri: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth', {
        body: { action: 'get-auth-url', redirectUri },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
  });
};

// Product sync
export const useImportProductsFromQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-products', {
        body: { action: 'import' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success(`Imported ${data.imported} products, updated ${data.updated}${data.conflicts > 0 ? `, ${data.conflicts} conflicts` : ''}`);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};

export const useExportProductsToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-products', {
        body: { action: 'export' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success(`Exported ${data.exported} products, updated ${data.updated}`);
    },
    onError: (error: Error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });
};

export const useSyncSingleProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-products', {
        body: { action: 'sync-single', productId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success("Product synced to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
};

export const useResolveProductConflict = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, resolution, newPrice }: { productId: string; resolution: 'use_commandx' | 'use_quickbooks' | 'custom'; newPrice?: number }) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-products', {
        body: { action: 'resolve-conflict', productId, resolution, newPrice },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-product-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success("Conflict resolved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to resolve conflict: ${error.message}`);
    },
  });
};

// Vendor sync hooks
export const useQuickBooksVendorMappings = () => {
  return useQuery({
    queryKey: ['quickbooks-vendor-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quickbooks_vendor_mappings')
        .select('*')
        .order('last_synced_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useImportVendorsFromQB = (onProgress?: (processed: number, total: number) => void, abortSignal?: AbortSignal) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (signal?: AbortSignal) => {
      const activeSignal = signal || abortSignal;
      let startPosition = 0;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
        // Check for cancellation before each batch
        if (activeSignal?.aborted) {
          return { 
            imported: totalImported, 
            updated: totalUpdated, 
            skipped: totalSkipped, 
            totalCount,
            cancelled: true 
          };
        }

        const { data, error } = await supabase.functions.invoke('quickbooks-sync-vendors', {
          body: { action: 'import', startPosition },
        });
        
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        totalImported += data.imported || 0;
        totalUpdated += data.updated || 0;
        totalSkipped += data.skipped || 0;
        totalCount = data.totalCount || 0;
        hasMore = data.hasMore || false;
        startPosition = data.nextStartPosition || 0;
        
        if (onProgress) {
          onProgress(data.processed || startPosition, totalCount);
        }
      }

      return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, totalCount, cancelled: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-logs'] });
      if (data.cancelled) {
        toast.info(`Import cancelled. ${data.imported} vendors were imported before cancellation.`);
      } else {
        toast.success(`Imported ${data.imported} vendors, updated ${data.updated}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to import vendors: ${error.message}`);
    },
  });
};

export const useExportVendorsToQB = (onProgress?: (processed: number, total: number) => void, abortSignal?: AbortSignal) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (signal?: AbortSignal) => {
      const activeSignal = signal || abortSignal;
      let startPosition = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
        // Check for cancellation before each batch
        if (activeSignal?.aborted) {
          return { 
            created: totalCreated, 
            updated: totalUpdated, 
            errors: totalErrors, 
            totalCount,
            cancelled: true 
          };
        }

        const { data, error } = await supabase.functions.invoke('quickbooks-sync-vendors', {
          body: { action: 'export', startPosition },
        });
        
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        totalCreated += data.created || 0;
        totalUpdated += data.updated || 0;
        totalErrors += data.errors || 0;
        totalCount = data.totalCount || 0;
        hasMore = data.hasMore || false;
        startPosition = data.nextStartPosition || 0;
        
        if (onProgress) {
          onProgress(data.processed || startPosition, totalCount);
        }
      }

      return { created: totalCreated, updated: totalUpdated, errors: totalErrors, totalCount, cancelled: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-logs'] });
      if (data.cancelled) {
        toast.info(`Export cancelled. ${data.created} vendors were exported before cancellation.`);
      } else {
        toast.success(`Exported ${data.created} vendors, updated ${data.updated}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to export vendors: ${error.message}`);
    },
  });
};

export const useSyncSingleVendor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendorId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-vendors', {
        body: { action: 'sync-single', vendorId },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      toast.success('Vendor synced to QuickBooks');
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync vendor: ${error.message}`);
    },
  });
};

// Personnel sync to QuickBooks
export const useSyncPersonnelToQB = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (personnelId: string) => {
      const { data, error } = await supabase.functions.invoke('sync-personnel-to-quickbooks', {
        body: { personnel_id: personnelId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync personnel: ${error.message}`);
    },
  });
};

// Customer sync
export const useImportCustomersFromQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-customers', {
        body: { action: 'import' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success(`Imported ${data.imported} customers, updated ${data.updated}`);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};

export const useExportCustomersToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-customers', {
        body: { action: 'export' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success(`Exported ${data.exported} customers, updated ${data.updated}`);
    },
    onError: (error: Error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });
};

// Invoice sync
export const useSyncInvoiceToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-create-invoice', {
        body: { invoiceId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success("Invoice synced to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Invoice sync failed: ${error.message}`);
    },
  });
};

// Vendor Bill sync - returns the full error for dialog handling
export interface VendorBillSyncResult {
  success: boolean;
  quickbooksBillId?: string;
  quickbooksDocNumber?: string;
  attachmentsSynced?: number;
  attachmentsFailed?: number;
  error?: string;
}

export const useSyncVendorBillToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (billId: string): Promise<VendorBillSyncResult> => {
      // First try to create (for unsynced bills)
      const { data, error } = await supabase.functions.invoke('quickbooks-create-bill', {
        body: { billId },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }

      // If bill was already synced, trigger an update to push latest changes
      if (data.message === 'Bill already synced' && data.quickbooksBillId) {
        const { data: updateData, error: updateError } = await supabase.functions.invoke('quickbooks-update-bill', {
          body: { billId },
        });
        if (updateError) {
          return { success: false, error: updateError.message };
        }
        if (updateData?.error) {
          return { success: false, error: updateData.error };
        }
      }

      return { 
        success: true, 
        quickbooksBillId: data.quickbooksBillId,
        quickbooksDocNumber: data.quickbooksDocNumber,
        attachmentsSynced: data.attachmentsSynced,
        attachmentsFailed: data.attachmentsFailed,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-bill-mappings"] });
      // Don't show toast here - let the caller handle it based on success/error
    },
    // Don't use onError - we return errors in the result instead
  });
};

// Get bill mapping
export const useQuickBooksBillMapping = (billId: string | undefined) => {
  return useQuery({
    queryKey: ["quickbooks-bill-mapping", billId],
    queryFn: async () => {
      if (!billId) return null;
      const { data, error } = await supabase
        .from("quickbooks_bill_mappings")
        .select("*")
        .eq("bill_id", billId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!billId,
  });
};

// Get all bill mappings
export const useQuickBooksBillMappings = () => {
  return useQuery({
    queryKey: ["quickbooks-bill-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quickbooks_bill_mappings")
        .select("*")
        .order("last_synced_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};

// Get next QuickBooks number (invoice, estimate, purchase_order, or vendor_bill)
export const useQuickBooksNextNumber = (type: 'invoice' | 'estimate' | 'purchase_order' | 'vendor_bill', enabled: boolean = true) => {
  return useQuery({
    queryKey: ["quickbooks-next-number", type],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-get-next-number', {
        body: { type },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.nextNumber as string;
    },
    enabled,
    staleTime: 0, // Always fetch fresh
    refetchOnWindowFocus: false,
  });
};

// Sync single customer to QuickBooks
export const useSyncCustomerToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-customers', {
        body: { action: 'sync-single', customerId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      toast.success("Customer synced to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Customer sync failed: ${error.message}`);
    },
  });
};

// Sync estimate to QuickBooks
export const useSyncEstimateToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-create-estimate', {
        body: { estimateId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-estimate-mappings"] });
      toast.success("Estimate synced to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Estimate sync failed: ${error.message}`);
    },
  });
};

// Sync purchase order to QuickBooks
export const useSyncPurchaseOrderToQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (purchaseOrderId: string) => {
      const { data, error } = await supabase.functions.invoke('quickbooks-create-purchase-order', {
        body: { purchaseOrderId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-po-mappings"] });
      toast.success("Purchase order synced to QuickBooks");
    },
    onError: (error: Error) => {
      toast.error(`Purchase order sync failed: ${error.message}`);
    },
  });
};

// Get estimate mapping
export const useQuickBooksEstimateMapping = (estimateId: string | undefined) => {
  return useQuery({
    queryKey: ["quickbooks-estimate-mapping", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const { data, error } = await supabase
        .from("quickbooks_estimate_mappings")
        .select("*")
        .eq("estimate_id", estimateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!estimateId,
  });
};

// Get PO mapping
export const useQuickBooksPOMapping = (purchaseOrderId: string | undefined) => {
  return useQuery({
    queryKey: ["quickbooks-po-mapping", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;
      const { data, error } = await supabase
        .from("quickbooks_po_mappings")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!purchaseOrderId,
  });
};

// Import invoices from QuickBooks
export const useImportInvoicesFromQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-import-invoices', {
        body: { action: 'import' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      const message = `Imported ${data.imported} invoices, updated ${data.updated}${data.skipped > 0 ? `, skipped ${data.skipped}` : ''}`;
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};

// Import expense categories/accounts from QuickBooks
export const useImportAccountsFromQB = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('quickbooks-sync-accounts', {
        body: { action: 'import' },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      const message = `Imported ${data.imported} categories, updated ${data.updated}${data.skipped > 0 ? `, skipped ${data.skipped}` : ''}`;
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
};
