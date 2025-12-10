import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../client";
import { toast } from "sonner";

export interface POAddendum {
  id: string;
  purchase_order_id: string;
  number: string | null;
  description: string;
  subtotal: number;
  amount: number;
  file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  // Customer approval fields
  customer_rep_name: string | null;
  customer_rep_title: string | null;
  customer_rep_email: string | null;
  approval_status: string | null;
  approval_token: string | null;
  sent_for_approval_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  approval_signature: string | null;
  approval_notes: string | null;
}

export interface POAddendumLineItem {
  id: string;
  po_addendum_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  markup: number;
  total: number;
  sort_order: number;
  created_at: string;
}

export const usePOAddendums = (purchaseOrderId: string) => {
  return useQuery({
    queryKey: ["po_addendums", purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_addendums")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as POAddendum[];
    },
    enabled: !!purchaseOrderId,
  });
};

export const usePOAddendumByToken = (token: string | undefined) => {
  return useQuery({
    queryKey: ["po_addendum_by_token", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      
      const { data, error } = await supabase
        .from("po_addendums")
        .select("*, purchase_orders:purchase_order_id(number, vendor_id, vendors:vendor_id(name))")
        .eq("approval_token", token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
};

export const usePOAddendumLineItems = (addendumId: string) => {
  return useQuery({
    queryKey: ["po_addendum_line_items", addendumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_addendum_line_items")
        .select("*")
        .eq("po_addendum_id", addendumId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as POAddendumLineItem[];
    },
    enabled: !!addendumId,
  });
};

interface AddAddendumData {
  purchaseOrderId: string;
  number: string;
  description: string;
  subtotal: number;
  amount: number;
  lineItems: {
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    markup: number;
    total: number;
    sortOrder: number;
  }[];
  file?: File;
  customerRepName?: string;
  customerRepTitle?: string;
  customerRepEmail?: string;
  sendForApproval?: boolean;
}

export const useAddPOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddAddendumData) => {
      const { data: { user } } = await supabase.auth.getUser();

      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // Upload file if provided
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        const uploadFileName = `${crypto.randomUUID()}.${fileExt}`;
        filePath = `po-addendums/${data.purchaseOrderId}/${uploadFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("document-attachments")
          .upload(filePath, data.file);

        if (uploadError) throw uploadError;

        fileName = data.file.name;
        fileType = data.file.type;
        fileSize = data.file.size;
      }

      // Generate approval token if sending for approval
      const approvalToken = data.sendForApproval ? crypto.randomUUID() : null;

      // Insert addendum record
      const { data: addendum, error } = await supabase
        .from("po_addendums")
        .insert({
          purchase_order_id: data.purchaseOrderId,
          number: data.number,
          description: data.description,
          subtotal: data.subtotal,
          amount: data.amount,
          file_name: fileName,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          uploaded_by: user?.id,
          customer_rep_name: data.customerRepName || null,
          customer_rep_title: data.customerRepTitle || null,
          customer_rep_email: data.customerRepEmail || null,
          approval_status: data.sendForApproval ? 'pending' : 'draft',
          approval_token: approvalToken,
        } as never)
        .select()
        .single();

      if (error) throw error;

      // Insert line items
      if (data.lineItems.length > 0) {
        const lineItemsToInsert = data.lineItems.map(item => ({
          po_addendum_id: addendum.id,
          product_id: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          markup: item.markup,
          total: item.total,
          sort_order: item.sortOrder,
        }));

        const { error: lineItemsError } = await supabase
          .from("po_addendum_line_items")
          .insert(lineItemsToInsert as never);

        if (lineItemsError) throw lineItemsError;
      }

      // Send for approval if requested
      if (data.sendForApproval && data.customerRepEmail) {
        try {
          const { error: sendError } = await supabase.functions.invoke('send-change-order-approval', {
            body: { addendumId: addendum.id }
          });
          
          if (sendError) {
            console.error("Failed to send approval email:", sendError);
            toast.error("Addendum created but failed to send approval email");
          }
        } catch (err) {
          console.error("Error sending approval email:", err);
        }
      }

      return addendum;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(variables.sendForApproval 
        ? "Addendum created and sent for approval" 
        : "Addendum added successfully"
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to add addendum: ${error.message}`);
    },
  });
};

export const useSendChangeOrderForApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addendumId: string) => {
      const { error } = await supabase.functions.invoke('send-change-order-approval', {
        body: { addendumId }
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums"] });
      toast.success("Approval request sent successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send approval request: ${error.message}`);
    },
  });
};

export const useApproveChangeOrder = () => {
  return useMutation({
    mutationFn: async (data: { 
      token: string; 
      signature: string; 
      approvedByName: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("po_addendums")
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_name: data.approvedByName,
          approval_signature: data.signature,
          approval_notes: data.notes || null,
        } as never)
        .eq("approval_token", data.token);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Change order approved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve change order: ${error.message}`);
    },
  });
};

export const useRejectChangeOrder = () => {
  return useMutation({
    mutationFn: async (data: { token: string; notes?: string }) => {
      const { error } = await supabase
        .from("po_addendums")
        .update({
          approval_status: 'rejected',
          approval_notes: data.notes || null,
        } as never)
        .eq("approval_token", data.token);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Change order rejected");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject change order: ${error.message}`);
    },
  });
};

interface UpdateAddendumData {
  id: string;
  purchaseOrderId: string;
  description: string;
  subtotal: number;
  amount: number;
  lineItems: {
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    markup: number;
    total: number;
    sortOrder: number;
  }[];
  file?: File;
  removeExistingFile?: boolean;
  existingFilePath?: string | null;
  customerRepName?: string;
  customerRepTitle?: string;
  customerRepEmail?: string;
  sendForApproval?: boolean;
}

export const useUpdatePOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAddendumData) => {
      const { data: { user } } = await supabase.auth.getUser();

      let filePath: string | null = data.existingFilePath || null;
      let fileName: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // Handle file removal
      if (data.removeExistingFile && data.existingFilePath) {
        await supabase.storage
          .from("document-attachments")
          .remove([data.existingFilePath]);
        filePath = null;
      }

      // Upload new file if provided
      if (data.file) {
        // Remove old file first if exists
        if (data.existingFilePath) {
          await supabase.storage
            .from("document-attachments")
            .remove([data.existingFilePath]);
        }

        const fileExt = data.file.name.split('.').pop();
        const uploadFileName = `${crypto.randomUUID()}.${fileExt}`;
        filePath = `po-addendums/${data.purchaseOrderId}/${uploadFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("document-attachments")
          .upload(filePath, data.file);

        if (uploadError) throw uploadError;

        fileName = data.file.name;
        fileType = data.file.type;
        fileSize = data.file.size;
      }

      // Generate new approval token if sending for approval
      const approvalToken = data.sendForApproval ? crypto.randomUUID() : null;

      // Build update object
      const updateData: Record<string, unknown> = {
        description: data.description,
        subtotal: data.subtotal,
        amount: data.amount,
        customer_rep_name: data.customerRepName || null,
        customer_rep_title: data.customerRepTitle || null,
        customer_rep_email: data.customerRepEmail || null,
      };

      // Only update file fields if file changed
      if (data.file) {
        updateData.file_name = fileName;
        updateData.file_path = filePath;
        updateData.file_type = fileType;
        updateData.file_size = fileSize;
        updateData.uploaded_by = user?.id;
      } else if (data.removeExistingFile) {
        updateData.file_name = null;
        updateData.file_path = null;
        updateData.file_type = null;
        updateData.file_size = null;
      }

      // Update approval status if sending
      if (data.sendForApproval) {
        updateData.approval_status = 'pending';
        updateData.approval_token = approvalToken;
        updateData.sent_for_approval_at = new Date().toISOString();
      }

      // Update addendum record
      const { data: addendum, error } = await supabase
        .from("po_addendums")
        .update(updateData as never)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;

      // Delete existing line items and re-insert
      const { error: deleteError } = await supabase
        .from("po_addendum_line_items")
        .delete()
        .eq("po_addendum_id", data.id);

      if (deleteError) throw deleteError;

      // Insert new line items
      if (data.lineItems.length > 0) {
        const lineItemsToInsert = data.lineItems.map(item => ({
          po_addendum_id: data.id,
          product_id: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          markup: item.markup,
          total: item.total,
          sort_order: item.sortOrder,
        }));

        const { error: lineItemsError } = await supabase
          .from("po_addendum_line_items")
          .insert(lineItemsToInsert as never);

        if (lineItemsError) throw lineItemsError;
      }

      // Send for approval if requested
      if (data.sendForApproval && data.customerRepEmail) {
        try {
          const { error: sendError } = await supabase.functions.invoke('send-change-order-approval', {
            body: { addendumId: addendum.id }
          });
          
          if (sendError) {
            console.error("Failed to send approval email:", sendError);
            toast.error("Addendum updated but failed to send approval email");
          }
        } catch (err) {
          console.error("Error sending approval email:", err);
        }
      }

      return addendum;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["po_addendum_line_items", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success(variables.sendForApproval 
        ? "Addendum updated and sent for approval" 
        : "Addendum updated successfully"
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to update addendum: ${error.message}`);
    },
  });
};

export const useDeletePOAddendum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; purchaseOrderId: string; filePath: string | null }) => {
      // Delete file from storage if exists
      if (data.filePath) {
        const { error: deleteFileError } = await supabase.storage
          .from("document-attachments")
          .remove([data.filePath]);

        if (deleteFileError) {
          console.warn("Failed to delete file:", deleteFileError);
        }
      }

      // Delete addendum record (line items will cascade)
      const { error } = await supabase
        .from("po_addendums")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["po_addendums", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Addendum deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete addendum: ${error.message}`);
    },
  });
};