import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1180;
const WIDE_TABLET_BREAKPOINT = 1366;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    const onChange = () => {
      const width = window.innerWidth;
      setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
    };
    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
    );
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTablet;
}

export function useIsWideTablet() {
  const [isWideTablet, setIsWideTablet] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      return width >= MOBILE_BREAKPOINT && width < WIDE_TABLET_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    const onChange = () => {
      const width = window.innerWidth;
      setIsWideTablet(width >= MOBILE_BREAKPOINT && width < WIDE_TABLET_BREAKPOINT);
    };
    const mql = window.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${WIDE_TABLET_BREAKPOINT - 1}px)`
    );
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isWideTablet;
}
