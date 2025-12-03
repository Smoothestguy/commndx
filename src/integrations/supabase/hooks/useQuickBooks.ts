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

export const useImportVendorsFromQB = (onProgress?: (processed: number, total: number) => void) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      let startPosition = 0;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
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

      return { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, totalCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-logs'] });
      toast.success(`Imported ${data.imported} vendors, updated ${data.updated}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import vendors: ${error.message}`);
    },
  });
};

export const useExportVendorsToQB = (onProgress?: (processed: number, total: number) => void) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      let startPosition = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let totalCount = 0;
      let hasMore = true;

      while (hasMore) {
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

      return { created: totalCreated, updated: totalUpdated, errors: totalErrors, totalCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-vendor-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-logs'] });
      toast.success(`Exported ${data.created} vendors, updated ${data.updated}`);
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

// Get next QuickBooks number (invoice or estimate)
export const useQuickBooksNextNumber = (type: 'invoice' | 'estimate', enabled: boolean = true) => {
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
