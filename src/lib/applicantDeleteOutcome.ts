export function applicantDeleteOutcome(expectedIds: string[], deletedIds: string[], deactivatedNames: string[]) {
  if (deactivatedNames.length) return 'kept' as const;
  return expectedIds.every(id => deletedIds.includes(id)) ? 'delete' as const : 'pending' as const;
}