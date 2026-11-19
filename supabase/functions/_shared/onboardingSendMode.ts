export function createOnlyMode(value: unknown) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error('createOnly must be a boolean');
  return value === true;
}