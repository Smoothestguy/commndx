import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.commndx.app',
  appName: 'Command X',
  webDir: 'dist',
  
  // Server configuration
  // For development: uncomment the url line below
  // For production: keep url commented out
  server: {
    // Development hot-reload (uncomment for local development):
    // url: 'http://localhost:5173',
    
    // Production settings
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  
  // iOS-specific configuration
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
  },
  
  // Android-specific configuration  
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: false, // Security: disabled for production
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disable for production
  },
  
  // Plugin configurations
  plugins: {
    // Status bar configuration
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
    
    // Keyboard configuration
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    
    // App configuration
    App: {
      launchShowDuration: 0,
    },
    
    // Push Notifications
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    
    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    
    // Background Geolocation configuration
    // BackgroundGeolocation: {
    //   license: 'YOUR_LICENSE_KEY',
    // },
  },
};

export default config;
