export type Ownership = 'owned' | 'rented';
export type RentalPeriod = 'day' | 'week' | 'month';

export function ownershipText(asset: { ownership?: string; vendor_name?: string | null } | null | undefined) {
  return asset?.ownership === 'rented' ? `Rented${asset.vendor_name ? ` · ${asset.vendor_name}` : ''}` : 'Owned';
}

export function validAssetCost(value: string) {
  return value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);
}

export function assetCareLabel(label: string, person?: { first_name: string | null; last_name: string | null } | null) {
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ');
  return name ? `${label} — ${name}` : label;
}