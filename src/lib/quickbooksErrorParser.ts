/**
 * QuickBooks Error Parser
 * Parses QuickBooks API errors and extracts actionable information
 */

export type QBErrorType = 
  | 'vendor_deleted' 
  | 'vendor_not_found' 
  | 'customer_deleted'
  | 'customer_not_found'
  | 'auth_error' 
  | 'rate_limit' 
  | 'stale_object'
  | 'duplicate'
  | 'validation'
  | 'unknown';

export type SuggestedAction = 
  | 'resync_vendor' 
  | 'resync_customer'
  | 'reconnect' 
  | 'retry' 
  | 'wait'
  | 'none';

export interface ParsedQBError {
  type: QBErrorType;
  title: string;
  description: string;
  vendorName?: string;
  vendorId?: string;
  customerName?: string;
  customerId?: string;
  actionable: boolean;
  suggestedAction: SuggestedAction;
  technicalDetails?: string;
}

// Error pattern matchers
const ERROR_PATTERNS: Array<{
  pattern: RegExp | ((msg: string) => boolean);
  type: QBErrorType;
  getDetails: (msg: string, context?: ErrorContext) => Partial<ParsedQBError>;
}> = [
  // Vendor deleted in QuickBooks
  {
    pattern: (msg: string) => 
      msg.includes('Invalid Reference Id') && 
      (msg.includes('Vendor') || msg.includes('vendor')) && 
      msg.includes('deleted'),
    type: 'vendor_deleted',
    getDetails: (msg, context) => ({
      title: 'Vendor Deleted in QuickBooks',
      description: context?.vendorName 
        ? `The vendor "${context.vendorName}" has been deleted in QuickBooks. Re-sync the vendor to create it again, or restore it in QuickBooks.`
        : 'The vendor for this bill has been deleted in QuickBooks. Re-sync the vendor to create it again.',
      vendorName: context?.vendorName,
      vendorId: context?.vendorId,
      actionable: true,
      suggestedAction: 'resync_vendor',
    }),
  },
  // Vendor not found / invalid reference
  {
    pattern: (msg: string) =>
      (msg.includes('Invalid Reference Id') || msg.includes('Vendor not found')) &&
      (msg.includes('Vendor') || msg.includes('vendor')),
    type: 'vendor_not_found',
    getDetails: (msg, context) => ({
      title: 'Vendor Not Found in QuickBooks',
      description: context?.vendorName
        ? `The vendor "${context.vendorName}" could not be found in QuickBooks. Try re-syncing the vendor.`
        : 'The vendor for this bill could not be found in QuickBooks. Try re-syncing the vendor.',
      vendorName: context?.vendorName,
      vendorId: context?.vendorId,
      actionable: true,
      suggestedAction: 'resync_vendor',
    }),
  },
  // Customer deleted in QuickBooks
  {
    pattern: (msg: string) => 
      msg.includes('Invalid Reference Id') && 
      (msg.includes('Customer') || msg.includes('customer')) && 
      msg.includes('deleted'),
    type: 'customer_deleted',
    getDetails: (msg, context) => ({
      title: 'Customer Deleted in QuickBooks',
      description: context?.customerName 
        ? `The customer "${context.customerName}" has been deleted in QuickBooks. Re-sync the customer to create it again, or restore it in QuickBooks.`
        : 'The customer has been deleted in QuickBooks. Re-sync the customer to create it again.',
      customerName: context?.customerName,
      customerId: context?.customerId,
      actionable: true,
      suggestedAction: 'resync_customer',
    }),
  },
  // Auth/token errors
  {
    pattern: (msg: string) =>
      msg.includes('401') ||
      msg.includes('Unauthorized') ||
      msg.includes('AuthenticationFailed') ||
      msg.includes('Token') && msg.includes('expired') ||
      msg.includes('refresh token'),
    type: 'auth_error',
    getDetails: () => ({
      title: 'QuickBooks Connection Expired',
      description: 'The QuickBooks connection has expired. Please reconnect to QuickBooks in settings.',
      actionable: true,
      suggestedAction: 'reconnect',
    }),
  },
  // Rate limiting
  {
    pattern: (msg: string) =>
      msg.includes('429') ||
      msg.includes('RateLimitExceeded') ||
      msg.includes('rate limit') ||
      msg.includes('Too Many Requests'),
    type: 'rate_limit',
    getDetails: () => ({
      title: 'QuickBooks Rate Limit',
      description: 'QuickBooks is temporarily limiting requests. Please wait a few minutes and try again.',
      actionable: true,
      suggestedAction: 'wait',
    }),
  },
  // Stale object (concurrent modification)
  {
    pattern: (msg: string) =>
      msg.includes('Stale Object') ||
      msg.includes('SyncToken'),
    type: 'stale_object',
    getDetails: () => ({
      title: 'Sync Conflict',
      description: 'The record was modified in QuickBooks while syncing. Please try again.',
      actionable: true,
      suggestedAction: 'retry',
    }),
  },
  // Duplicate
  {
    pattern: (msg: string) =>
      msg.includes('Duplicate') ||
      msg.includes('already exists'),
    type: 'duplicate',
    getDetails: () => ({
      title: 'Duplicate Record',
      description: 'A record with this information already exists in QuickBooks.',
      actionable: false,
      suggestedAction: 'none',
    }),
  },
  // Validation errors
  {
    pattern: (msg: string) =>
      msg.includes('Validation') ||
      msg.includes('required') ||
      msg.includes('invalid'),
    type: 'validation',
    getDetails: (msg) => ({
      title: 'Validation Error',
      description: 'QuickBooks rejected the data. Please check the bill details and try again.',
      actionable: true,
      suggestedAction: 'retry',
      technicalDetails: msg,
    }),
  },
];

export interface ErrorContext {
  vendorName?: string;
  vendorId?: string;
  customerName?: string;
  customerId?: string;
  billNumber?: string;
  invoiceNumber?: string;
}

/**
 * Parse a QuickBooks API error message into structured, actionable data
 */
export function parseQuickBooksError(
  errorMessage: string,
  context?: ErrorContext
): ParsedQBError {
  const normalizedMessage = errorMessage.toLowerCase();
  
  // Try each pattern
  for (const { pattern, type, getDetails } of ERROR_PATTERNS) {
    const matches = typeof pattern === 'function' 
      ? pattern(normalizedMessage) || pattern(errorMessage)
      : pattern.test(errorMessage);
    
    if (matches) {
      const details = getDetails(errorMessage, context);
      return {
        type,
        title: details.title || 'Sync Error',
        description: details.description || errorMessage,
        vendorName: details.vendorName || context?.vendorName,
        vendorId: details.vendorId || context?.vendorId,
        customerName: details.customerName || context?.customerName,
        customerId: details.customerId || context?.customerId,
        actionable: details.actionable ?? false,
        suggestedAction: details.suggestedAction || 'none',
        technicalDetails: details.technicalDetails || errorMessage,
      };
    }
  }
  
  // Default unknown error
  return {
    type: 'unknown',
    title: 'QuickBooks Sync Failed',
    description: 'An unexpected error occurred while syncing to QuickBooks. Please try again.',
    vendorName: context?.vendorName,
    vendorId: context?.vendorId,
    actionable: true,
    suggestedAction: 'retry',
    technicalDetails: errorMessage,
  };
}

/**
 * Get a user-friendly error message based on error type
 */
export function getErrorTypeLabel(type: QBErrorType): string {
  const labels: Record<QBErrorType, string> = {
    vendor_deleted: 'Vendor Issue',
    vendor_not_found: 'Vendor Issue',
    customer_deleted: 'Customer Issue',
    customer_not_found: 'Customer Issue',
    auth_error: 'Connection Issue',
    rate_limit: 'Rate Limited',
    stale_object: 'Sync Conflict',
    duplicate: 'Duplicate',
    validation: 'Validation Error',
    unknown: 'Sync Error',
  };
  return labels[type];
}

/**
 * Get variant for error type badge
 */
export function getErrorTypeVariant(type: QBErrorType): 'destructive' | 'warning' | 'default' {
  switch (type) {
    case 'auth_error':
    case 'vendor_deleted':
    case 'customer_deleted':
      return 'destructive';
    case 'rate_limit':
    case 'stale_object':
    case 'validation':
      return 'warning';
    default:
      return 'default';
  }
}
