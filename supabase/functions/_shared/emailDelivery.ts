// Inspect delivery rejection without changing the caller's approval/alert workflow.
export async function reportEmailRejection(
  response: Response,
  context: string,
  recordFailure?: (detail: string) => PromiseLike<{ error?: { message: string } | null }>,
): Promise<string | null> {
  if (response.ok) return null;
  const body = await response.text();
  const detail = `Resend HTTP ${response.status}: ${body}`;
  await recordEmailFailure(context, detail, recordFailure);
  return detail;
}

export async function recordEmailFailure(
  context: string,
  detail: string,
  recordFailure?: (detail: string) => PromiseLike<{ error?: { message: string } | null }>,
): Promise<void> {
  console.error(`[${context}] Email delivery failed: ${detail}`);
  if (!recordFailure) return;
  try {
    const result = await recordFailure(detail);
    if (result.error) console.error(`[${context}] Email failure log failed: ${result.error.message}`);
  } catch {
    console.error(`[${context}] Email failure log unavailable`);
  }
}