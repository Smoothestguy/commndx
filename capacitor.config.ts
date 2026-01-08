import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.commndx.app',
  appName: 'Command X',
  webDir: 'dist',
  
  // Server configuration for development
  // Comment out for production builds
  server: {
    // For development with hot reload, uncomment the url below:
    // url: 'http://localhost:5173',
    cleartext: true,
    androidScheme: 'https',
  },
  
  // iOS-specific configuration
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  
  // Android-specific configuration  
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
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
    
    // Background Geolocation configuration (will be added in Phase 2)
    // BackgroundGeolocation: {
    //   license: 'YOUR_LICENSE_KEY',
    // },
  },
};

export default config;

