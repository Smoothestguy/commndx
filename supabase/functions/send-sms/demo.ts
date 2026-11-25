/** Standalone demo send: no personnel lookup, token, alert or message writes. */
export async function sendDemoSms(body: unknown, role: string, config: { accountSid?: string; authToken?: string; from?: string; siteUrl: string }, request: typeof fetch = fetch) {
  if (role !== 'admin') return { status: 403, body: { error: 'Admin access required' } };
  const phone = typeof body === 'object' && body !== null && 'recipientPhone' in body ? body.recipientPhone : null;
  if (typeof phone !== 'string' || phone.length > 40) return { status: 400, body: { error: 'Enter a valid phone number' } };
  const digits = phone.replace(/\D/g, '');
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) return { status: 400, body: { error: 'Enter a valid US phone number' } };
  if (!config.accountSid || !config.authToken || !config.from) return { status: 503, body: { error: 'SMS service not configured' } };
  const response = await request(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: digits.length === 10 ? `+1${digits}` : `+${digits}`, From: config.from, Body: `Fairfield clock-in DEMO (nothing is saved): ${config.siteUrl.replace(/\/$/, '')}/punch/demo` }),
  });
  if (!response.ok) {
    const details = await response.text();
    console.error(`Demo SMS provider failed [${response.status}]: ${details}`);
    return { status: response.status, body: { error: 'Text not sent', status: response.status, details } };
  }
  return { status: 200, body: { success: true } };
}