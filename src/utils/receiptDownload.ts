/**
 * Forces a file download by fetching as blob and triggering download.
 * Works around cross-origin restrictions on the download attribute.
 */
export async function downloadReceipt(
  receiptUrl: string,
  suggestedFilename?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(receiptUrl);
    if (!response.ok) throw new Error("Receipt file unavailable");

    const blob = await response.blob();

    // Extract filename from URL if not provided
    const urlFilename = receiptUrl.split("/").pop()?.split("?")[0] || "receipt";
    const filename = suggestedFilename || urlFilename;

    // Create blob URL and trigger download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download receipt",
    };
  }
}

/**
 * Generates a friendly filename from reimbursement data.
 */
export function getReceiptFilename(
  description: string,
  submittedAt: string,
  originalUrl: string
): string {
  const date = new Date(submittedAt).toISOString().split("T")[0];
  const ext = originalUrl.split(".").pop()?.split("?")[0] || "file";
  const sanitizedDesc = description
    .substring(0, 30)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `receipt-${sanitizedDesc}-${date}.${ext}`;
}
