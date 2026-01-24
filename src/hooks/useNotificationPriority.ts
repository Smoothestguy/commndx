import { useMemo } from "react";

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export interface NotificationWithPriority {
  id: string;
  is_read: boolean;
  priority?: NotificationPriority;
  notification_type: string;
  created_at: string;
  escalation_count?: number;
}

export interface BadgeState {
  count: number;
  color: "destructive" | "primary" | "muted";
  pulse: boolean;
}

// Map notification types to their default priority
export const NOTIFICATION_PRIORITY: Record<string, NotificationPriority> = {
  // CRITICAL - Blocks operations or requires immediate action
  message_failed: "critical",
  late_clock_in_attempt: "critical",
  missed_clock_in: "critical",
  auto_clock_out: "critical",
  geofence_violation: "critical",
  
  // HIGH - Time-sensitive, needs attention soon
  po_approval: "high",
  co_approval: "high",
  personnel_registration: "high",
  new_application: "high",
  
  // NORMAL - Standard operational notifications
  application_approved: "normal",
  application_rejected: "normal",
  onboarding_email_sent: "normal",
  onboarding_started: "normal",
  onboarding_complete: "normal",
  general: "normal",
  
  // LOW - Informational only
  reminder_sent: "low",
} as const;

// Escalation rules for unread notifications
export interface EscalationRule {
  initialPriority: NotificationPriority;
  escalateAfter: number; // minutes
  maxEscalations: number;
  escalateTo: NotificationPriority;
}

export const ESCALATION_RULES: Record<string, EscalationRule> = {
  po_approval: {
    initialPriority: "high",
    escalateAfter: 15,
    maxEscalations: 1,
    escalateTo: "critical",
  },
  co_approval: {
    initialPriority: "high",
    escalateAfter: 15,
    maxEscalations: 1,
    escalateTo: "critical",
  },
  personnel_registration: {
    initialPriority: "high",
    escalateAfter: 30,
    maxEscalations: 1,
    escalateTo: "critical",
  },
  new_application: {
    initialPriority: "high",
    escalateAfter: 60,
    maxEscalations: 1,
    escalateTo: "critical",
  },
  message_failed: {
    initialPriority: "critical",
    escalateAfter: 0,
    maxEscalations: 0,
    escalateTo: "critical",
  },
};

// Human-readable error messages for SMS failures
export const SMS_ERROR_MESSAGES: Record<string, {
  title: string;
  description: string;
  action: string;
}> = {
  invalid_number: {
    title: "Invalid Phone Number",
    description: "The phone number format is incorrect.",
    action: "Edit contact details and try again.",
  },
  undeliverable: {
    title: "Number Not Reachable",
    description: "The recipient's phone cannot receive SMS right now.",
    action: "Try again later or send as in-app message.",
  },
  blocked: {
    title: "Message Blocked",
    description: "The carrier blocked this message.",
    action: "Contact the recipient through another channel.",
  },
  rate_limit: {
    title: "Too Many Messages",
    description: "SMS rate limit exceeded.",
    action: "Wait a few minutes and try again.",
  },
  network_error: {
    title: "Connection Lost",
    description: "Your message was saved but not sent.",
    action: "Check your internet and tap Retry.",
  },
  unknown: {
    title: "Send Failed",
    description: "Something went wrong sending this message.",
    action: "Tap Retry to try again.",
  },
};

export function getNotificationPriority(
  notification: NotificationWithPriority
): NotificationPriority {
  // Use explicit priority if set, otherwise use type-based default
  return (
    notification.priority ||
    NOTIFICATION_PRIORITY[notification.notification_type] ||
    "normal"
  );
}

export function useNotificationBadgeState(
  notifications: NotificationWithPriority[] | undefined
): BadgeState {
  return useMemo(() => {
    if (!notifications || notifications.length === 0) {
      return { count: 0, color: "muted", pulse: false };
    }

    const unread = notifications.filter((n) => !n.is_read);
    
    if (unread.length === 0) {
      return { count: 0, color: "muted", pulse: false };
    }

    const hasCritical = unread.some(
      (n) => getNotificationPriority(n) === "critical"
    );
    const hasHigh = unread.some(
      (n) => getNotificationPriority(n) === "high"
    );

    return {
      count: unread.length,
      color: hasCritical || hasHigh ? "destructive" : "primary",
      pulse: hasCritical,
    };
  }, [notifications]);
}

export function getErrorMessage(errorCode: string | null | undefined) {
  if (!errorCode) {
    return SMS_ERROR_MESSAGES.unknown;
  }
  return SMS_ERROR_MESSAGES[errorCode] || SMS_ERROR_MESSAGES.unknown;
}

export function shouldEscalate(
  notification: NotificationWithPriority
): boolean {
  const rule = ESCALATION_RULES[notification.notification_type];
  if (!rule) return false;

  const createdAt = new Date(notification.created_at);
  const now = new Date();
  const minutesSinceCreated = (now.getTime() - createdAt.getTime()) / 60000;

  return (
    !notification.is_read &&
    minutesSinceCreated >= rule.escalateAfter &&
    (notification.escalation_count || 0) < rule.maxEscalations
  );
}
