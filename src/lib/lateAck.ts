export const LATE_ACK_PRESETS = ['Not registered yet', "Hadn't received punch link", 'Traffic/travel', 'Approved early release/extension', 'Supervisor knows'] as const;

/** Combined manager approval reason: preset and/or free text; empty when neither given. */
export function lateAckText(preset: string, text: string) {
  return [preset.trim(), text.trim()].filter(Boolean).join(' — ');
}
