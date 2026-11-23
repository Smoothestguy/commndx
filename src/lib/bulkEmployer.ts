export const FRG = '__frg__';
/** Customer employer ⇒ non-billable (and no agency); FRG ⇒ billable, no customer employer. */
export function employerPatch(choice: string) {
  return choice === FRG
    ? { employer_customer_id: null, non_billable: false }
    : { employer_customer_id: choice, vendor_id: null, non_billable: true };
}
