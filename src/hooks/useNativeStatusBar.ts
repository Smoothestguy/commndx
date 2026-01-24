import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export const useNativeStatusBar = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const updateStatusBar = async () => {
      try {
        if (resolvedTheme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark }); // Light text on dark background
          await StatusBar.setBackgroundColor({ color: '#141414' });
        } else {
          await StatusBar.setStyle({ style: Style.Light }); // Dark text on light background
          await StatusBar.setBackgroundColor({ color: '#e5e5e5' });
        }
      } catch (e) {
        console.log('StatusBar update failed:', e);
      }
    };

    updateStatusBar();
  }, [resolvedTheme]);
};
