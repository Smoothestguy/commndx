interface NotificationPreferences {
  event_accepted: boolean;
  event_expired: boolean;
  event_cancelled: boolean;
  event_reminder_sent: boolean;
  event_sent: boolean;
  event_resent: boolean;
  notification_toast: boolean;
  notification_sound: boolean;
  notification_browser: boolean;
}

interface NotificationOptions {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

// Notification sound - using a simple beep tone
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
};

const showBrowserNotification = (title: string, body: string) => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
  }
};

export const shouldNotifyForEvent = (
  action: string,
  preferences: NotificationPreferences | null
): boolean => {
  if (!preferences) return true; // Default to showing notifications if no preferences set

  switch (action) {
    case "accepted":
      return preferences.event_accepted;
    case "expired":
      return preferences.event_expired;
    case "cancelled":
      return preferences.event_cancelled;
    case "reminder_sent":
      return preferences.event_reminder_sent;
    case "sent":
      return preferences.event_sent;
    case "resent":
      return preferences.event_resent;
    default:
      return true;
  }
};

export const triggerNotification = (
  options: NotificationOptions,
  preferences: NotificationPreferences | null,
  toastFunction: (options: any) => void
) => {
  if (!preferences) {
    // Default behavior - show toast only
    toastFunction(options);
    return;
  }

  // Show toast notification
  if (preferences.notification_toast) {
    toastFunction(options);
  }

  // Play sound
  if (preferences.notification_sound) {
    playNotificationSound();
  }

  // Show browser notification
  if (preferences.notification_browser) {
    showBrowserNotification(options.title, options.description);
  }
};
