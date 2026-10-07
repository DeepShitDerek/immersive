import { useState, useEffect } from "react";

// Defines how many days to show at each breakpoint
const BREAKPOINTS = {
  sm: 640, // 7 days
  md: 768, // 10 days
  lg: 1024, // 14 days
};

export function useResponsiveDays() {
  const [daysToShow, setDaysToShow] = useState(5); // Default for mobile
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // This runs only on the client, preventing SSR mismatch
    setMounted(true);

    const getDaysForWidth = (width: number) => {
      if (width >= BREAKPOINTS.lg) return 14;
      if (width >= BREAKPOINTS.md) return 10;
      if (width >= BREAKPOINTS.sm) return 7;
      return 5; // Mobile default
    };

    // Set initial value on mount
    setDaysToShow(getDaysForWidth(window.innerWidth));

    const handleResize = () => {
      setDaysToShow(getDaysForWidth(window.innerWidth));
    };

    window.addEventListener("resize", handleResize);
    // Cleanup listener on component unmount
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Return a stable mobile-first value until client-side has mounted
  return mounted ? daysToShow : 5;
}
