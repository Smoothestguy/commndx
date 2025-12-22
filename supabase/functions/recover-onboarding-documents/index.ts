import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { personnelId, sessionFolder, dryRun = true } = await req.json();

    if (!personnelId) {
      return new Response(
        JSON.stringify({ error: "personnelId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Recovery] Starting document recovery for personnel: ${personnelId}, sessionFolder: ${sessionFolder}, dryRun: ${dryRun}`);

    // Get personnel info
    const { data: personnel, error: personnelError } = await supabase
      .from("personnel")
      .select("id, first_name, last_name, email")
      .eq("id", personnelId)
      .single();

    if (personnelError || !personnel) {
      console.error("[Recovery] Personnel not found:", personnelError);
      return new Response(
        JSON.stringify({ error: "Personnel not found", details: personnelError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Recovery] Found personnel: ${personnel.first_name} ${personnel.last_name}`);

    // Check existing documents
    const { data: existingDocs, error: existingError } = await supabase
      .from("personnel_documents")
      .select("id, file_path, document_type")
      .eq("personnel_id", personnelId);

    if (existingError) {
      console.error("[Recovery] Error checking existing docs:", existingError);
    }

    console.log(`[Recovery] Existing documents in DB: ${existingDocs?.length || 0}`);

    // If sessionFolder is provided, recover from that specific folder
    if (sessionFolder) {
      const { data: folderContents, error: folderError } = await supabase.storage
        .from("personnel-documents")
        .list(`pending/${sessionFolder}`, { limit: 100 });

      if (folderError) {
        console.error(`[Recovery] Error listing folder pending/${sessionFolder}:`, folderError);
        return new Response(
          JSON.stringify({ error: "Failed to list session folder", details: folderError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const documentsToRecover: Array<{
        sourcePath: string;
        destPath: string;
        fileName: string;
        documentType: string;
        fileType: string;
        fileSize: number;
      }> = [];

      // Determine document type from filename
      const getDocumentType = (filename: string): string => {
        const lower = filename.toLowerCase();
        if (lower.includes("government_id") || lower.includes("govt_id")) return "government_id";
        if (lower.includes("ssn") || lower.includes("social_security")) return "ssn_card";
        if (lower.includes("work_permit")) return "work_permit";
        if (lower.includes("i94") || lower.includes("i-94")) return "i94";
        if (lower.includes("passport")) return "passport";
        if (lower.includes("driver") || lower.includes("license")) return "drivers_license";
        if (lower.includes("birth")) return "birth_certificate";
        if (lower.includes("signature")) return "signature";
        return "other";
      };

      // Get file type from extension
      const getFileType = (filename: string): string => {
        const ext = filename.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          pdf: "application/pdf",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };
        return mimeTypes[ext || ""] || "application/octet-stream";
      };

      if (folderContents) {
        for (const file of folderContents) {
          if (file.id !== null) {
            const sourcePath = `pending/${sessionFolder}/${file.name}`;
            const destPath = `personnel/${personnelId}/${file.name}`;
            
            // Skip if already exists in DB
            const existsInDb = existingDocs?.some(e => 
              e.file_path === destPath || e.file_path === sourcePath
            );
            
            if (!existsInDb) {
              documentsToRecover.push({
                sourcePath,
                destPath,
                fileName: file.name,
                documentType: getDocumentType(file.name),
                fileType: getFileType(file.name),
                fileSize: file.metadata?.size || 0,
              });
            }
          }
        }
      }

      console.log(`[Recovery] Documents to recover: ${documentsToRecover.length}`);

      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            personnel: {
              id: personnel.id,
              name: `${personnel.first_name} ${personnel.last_name}`,
              email: personnel.email,
            },
            existingDocuments: existingDocs?.length || 0,
            documentsToRecover,
            message: "Dry run complete. Set dryRun: false to actually recover documents.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Actually recover documents
      const recoveredDocs: Array<{ fileName: string; newPath: string }> = [];
      const failedDocs: Array<{ fileName: string; error: string }> = [];

      for (const doc of documentsToRecover) {
        try {
          // Move file from pending to personnel folder
          const { error: moveError } = await supabase.storage
            .from("personnel-documents")
            .move(doc.sourcePath, doc.destPath);

          if (moveError) {
            console.error(`[Recovery] Failed to move ${doc.sourcePath}:`, moveError);
            failedDocs.push({ fileName: doc.fileName, error: moveError.message });
            continue;
          }

          // Insert document record into database
          const { error: insertError } = await supabase
            .from("personnel_documents")
            .insert({
              personnel_id: personnelId,
              document_type: doc.documentType,
              file_name: doc.fileName,
              file_path: doc.destPath,
              file_type: doc.fileType,
              file_size: doc.fileSize,
            });

          if (insertError) {
            console.error(`[Recovery] Failed to insert record for ${doc.fileName}:`, insertError);
            failedDocs.push({ fileName: doc.fileName, error: insertError.message });
            continue;
          }

          recoveredDocs.push({ fileName: doc.fileName, newPath: doc.destPath });
          console.log(`[Recovery] Successfully recovered: ${doc.fileName}`);

        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[Recovery] Error recovering ${doc.fileName}:`, err);
          failedDocs.push({ fileName: doc.fileName, error: errorMessage });
        }
      }

      return new Response(
        JSON.stringify({
          success: failedDocs.length === 0,
          dryRun: false,
          personnel: {
            id: personnel.id,
            name: `${personnel.first_name} ${personnel.last_name}`,
            email: personnel.email,
          },
          recoveredDocuments: recoveredDocs,
          failedDocuments: failedDocs,
          message: `Recovered ${recoveredDocs.length} documents, ${failedDocs.length} failed`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no sessionFolder, list all pending folders
    const { data: pendingFiles, error: pendingError } = await supabase.storage
      .from("personnel-documents")
      .list("pending", { limit: 1000 });

    if (pendingError) {
      console.error("[Recovery] Error listing pending folder:", pendingError);
    }

    const allPendingFolders: Array<{ folder: string; files: Array<{ path: string; name: string; size: number }> }> = [];
    
    if (pendingFiles) {
      for (const item of pendingFiles) {
        if (item.id === null) {
          const { data: folderContents, error: folderError } = await supabase.storage
            .from("personnel-documents")
            .list(`pending/${item.name}`, { limit: 100 });

          if (folderError) {
            console.error(`[Recovery] Error listing folder pending/${item.name}:`, folderError);
            continue;
          }

          const files: Array<{ path: string; name: string; size: number }> = [];
          if (folderContents) {
            for (const file of folderContents) {
              if (file.id !== null) {
                files.push({
                  path: `pending/${item.name}/${file.name}`,
                  name: file.name,
                  size: file.metadata?.size || 0
                });
              }
            }
          }

          if (files.length > 0) {
            allPendingFolders.push({ folder: item.name, files });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: true,
        personnel: {
          id: personnel.id,
          name: `${personnel.first_name} ${personnel.last_name}`,
          email: personnel.email,
        },
        existingDocuments: existingDocs?.length || 0,
        pendingFolders: allPendingFolders,
        message: "Please specify a sessionFolder to recover documents from. Look at pendingFolders to find the right one based on timestamp.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Recovery] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
