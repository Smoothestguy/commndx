import { format } from "date-fns";

export interface ActivityDescription {
  title: string;
  description: string;
  icon: string;
  color: "green" | "blue" | "red" | "yellow" | "purple" | "gray";
  details: string[];
  resourceLink?: string;
}

interface AuditLogActivity {
  id: string;
  created_at: string;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  resource_number: string | null;
  changes_before: Record<string, unknown> | null;
  changes_after: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

interface SessionActivity {
  id: string;
  created_at: string;
  activity_type: string;
  route?: string;
  action_name?: string;
  context?: Record<string, unknown>;
}

const resourceTypeLabels: Record<string, string> = {
  estimate: "Estimate",
  invoice: "Invoice",
  purchase_order: "Purchase Order",
  job_order: "Job Order",
  change_order: "Change Order",
  vendor_bill: "Vendor Bill",
  personnel: "Personnel",
  vendor: "Vendor",
  project: "Project",
  customer: "Customer",
  auth: "Authentication",
  user: "User",
  permission: "Permission",
  file: "File",
  quickbooks: "QuickBooks",
  tm_ticket: "T&M Ticket",
  time_entry: "Time Entry",
};

const actionTypeLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  view: "Viewed",
  approve: "Approved",
  reject: "Rejected",
  send: "Sent",
  complete: "Completed",
  sign_in: "Signed In",
  sign_out: "Signed Out",
  sign_up: "Signed Up",
  payment: "Recorded Payment",
  sync: "Synced",
  upload: "Uploaded",
  download: "Downloaded",
  invite: "Invited",
  status_change: "Changed Status",
};

const actionColors: Record<string, ActivityDescription["color"]> = {
  create: "green",
  sign_in: "green",
  approve: "green",
  complete: "green",
  sign_up: "green",
  update: "blue",
  view: "blue",
  sync: "blue",
  delete: "red",
  sign_out: "red",
  reject: "red",
  send: "purple",
  upload: "purple",
  download: "purple",
  invite: "purple",
  payment: "yellow",
  status_change: "yellow",
};

const actionIcons: Record<string, string> = {
  create: "➕",
  update: "📝",
  delete: "🗑️",
  view: "👁️",
  approve: "✅",
  reject: "❌",
  send: "📤",
  complete: "🏁",
  sign_in: "🟢",
  sign_out: "🔴",
  sign_up: "🎉",
  payment: "💵",
  sync: "🔄",
  upload: "📤",
  download: "📥",
  invite: "✉️",
  status_change: "🔄",
};

const pageNameMap: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/estimates": "Estimates",
  "/invoices": "Invoices",
  "/purchase-orders": "Purchase Orders",
  "/job-orders": "Job Orders",
  "/change-orders": "Change Orders",
  "/vendor-bills": "Vendor Bills",
  "/time-tracking": "Time Tracking",
  "/personnel": "Personnel",
  "/vendors": "Vendors",
  "/projects": "Projects",
  "/customers": "Customers",
  "/settings": "Settings",
  "/admin": "Admin",
  "/audit-log": "Audit Log",
  "/session-history": "Session History",
  "/activity-history": "Activity History",
};

function getPageName(route: string): string {
  // Check exact match first
  if (pageNameMap[route]) return pageNameMap[route];
  
  // Check if route starts with any known path
  for (const [path, name] of Object.entries(pageNameMap)) {
    if (route.startsWith(path) && path !== "/") {
      return name;
    }
  }
  
  // Extract last part of route and format
  const parts = route.split("/").filter(Boolean);
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    // Check if it's a UUID (resource detail page)
    if (/^[0-9a-f-]{36}$/i.test(lastPart) && parts.length > 1) {
      const resourceType = parts[parts.length - 2];
      return `${formatResourceType(resourceType)} Details`;
    }
    return formatResourceType(lastPart);
  }
  
  return route;
}

function formatResourceType(type: string): string {
  return type
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    if (["updated_at", "created_at", "id"].includes(key)) continue;
    
    const beforeVal = before[key];
    const afterVal = after[key];
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      const formattedKey = key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      if (beforeVal === null || beforeVal === undefined) {
        changes.push(`Set ${formattedKey} to "${afterVal}"`);
      } else if (afterVal === null || afterVal === undefined) {
        changes.push(`Cleared ${formattedKey}`);
      } else {
        changes.push(`Changed ${formattedKey} from "${beforeVal}" to "${afterVal}"`);
      }
    }
  }
  
  return changes;
}

function extractCreateDetails(data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  
  const details: string[] = [];
  const importantFields = ["name", "number", "customer_name", "vendor_name", "project_name", "total", "status", "email", "title"];
  
  for (const field of importantFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const formattedKey = field
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      
      let value = data[field];
      if (field === "total" && typeof value === "number") {
        value = `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      }
      
      details.push(`${formattedKey}: ${value}`);
    }
  }
  
  return details;
}

function getResourceLink(resourceType: string, resourceId: string | null): string | undefined {
  if (!resourceId) return undefined;
  
  const routeMap: Record<string, string> = {
    estimate: "/estimates",
    invoice: "/invoices",
    purchase_order: "/purchase-orders",
    job_order: "/job-orders",
    change_order: "/change-orders",
    vendor_bill: "/vendor-bills",
    personnel: "/personnel",
    vendor: "/vendors",
    project: "/projects",
    customer: "/customers",
  };
  
  const baseRoute = routeMap[resourceType];
  if (baseRoute) {
    return `${baseRoute}/${resourceId}`;
  }
  
  return undefined;
}

export function generateAuditActivityDescription(log: AuditLogActivity): ActivityDescription {
  const resourceLabel = resourceTypeLabels[log.resource_type] || formatResourceType(log.resource_type);
  const actionLabel = actionTypeLabels[log.action_type] || log.action_type;
  const color = actionColors[log.action_type] || "gray";
  const icon = actionIcons[log.action_type] || "📌";
  
  let title = `${actionLabel} ${resourceLabel}`;
  let description = "";
  let details: string[] = [];
  
  const resourceRef = log.resource_number || log.resource_id?.substring(0, 8);
  
  switch (log.action_type) {
    case "create":
      description = `You created a new ${resourceLabel.toLowerCase()}${resourceRef ? ` (${resourceRef})` : ""}`;
      details = extractCreateDetails(log.changes_after);
      break;
    case "update":
      description = `You made changes to ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      details = formatChanges(log.changes_before, log.changes_after);
      break;
    case "delete":
      description = `You deleted ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      break;
    case "approve":
      description = `You approved ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      break;
    case "reject":
      description = `You rejected ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      break;
    case "send":
      description = `You sent ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      break;
    case "sign_in":
      title = "Signed In";
      description = "You signed into your account";
      break;
    case "sign_out":
      title = "Signed Out";
      description = "You signed out of your account";
      break;
    case "sign_up":
      title = "Account Created";
      description = "You created your account";
      break;
    case "payment":
      description = `You recorded a payment for ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      break;
    case "sync":
      description = `You synced ${resourceLabel.toLowerCase()} with QuickBooks`;
      break;
    case "status_change":
      description = `You changed the status of ${resourceLabel.toLowerCase()} ${resourceRef || ""}`;
      details = formatChanges(log.changes_before, log.changes_after);
      break;
    default:
      description = `You performed ${log.action_type} on ${resourceLabel.toLowerCase()}`;
  }
  
  if (!log.success && log.error_message) {
    details.push(`Error: ${log.error_message}`);
  }
  
  return {
    title,
    description,
    icon,
    color: log.success ? color : "red",
    details,
    resourceLink: getResourceLink(log.resource_type, log.resource_id),
  };
}

export function generateSessionActivityDescription(activity: SessionActivity): ActivityDescription {
  const activityType = activity.activity_type;
  
  switch (activityType) {
    case "page_view":
    case "navigation":
      const pageName = activity.route ? getPageName(activity.route) : "Unknown Page";
      return {
        title: `Visited ${pageName}`,
        description: `You navigated to ${pageName}`,
        icon: "📍",
        color: "blue",
        details: activity.route ? [`Route: ${activity.route}`] : [],
      };
    case "clock_in":
      return {
        title: "Clocked In",
        description: "You started a work session",
        icon: "🟢",
        color: "green",
        details: [],
      };
    case "clock_out":
      return {
        title: "Clocked Out",
        description: "You ended your work session",
        icon: "🔴",
        color: "red",
        details: [],
      };
    case "idle_start":
      return {
        title: "Went Idle",
        description: "You became inactive",
        icon: "💤",
        color: "yellow",
        details: [],
      };
    case "idle_end":
      return {
        title: "Returned from Idle",
        description: "You resumed activity",
        icon: "⏰",
        color: "green",
        details: [],
      };
    case "button_click":
    case "action":
      const actionName = activity.action_name || "an action";
      return {
        title: `Performed Action`,
        description: `You clicked ${actionName}`,
        icon: "👆",
        color: "blue",
        details: activity.action_name ? [`Action: ${activity.action_name}`] : [],
      };
    default:
      return {
        title: formatResourceType(activityType),
        description: `You performed ${activityType}`,
        icon: "📌",
        color: "gray",
        details: [],
      };
  }
}

export function formatActivityTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, "h:mm a");
  } catch {
    return "";
  }
}

export function formatActivityDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return format(date, "EEEE, MMMM d, yyyy");
    }
  } catch {
    return dateString;
  }
}
