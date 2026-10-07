import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ManagerWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard wrapper for all admin manager components.
 * Enforces consistent spacing and mobile bottom padding.
 */
export default function ManagerWrapper({
  children,
  className,
}: ManagerWrapperProps) {
  return (
    <div className={cn("space-y-6", "pb-20 md:pb-0", className)}>
      {children}
    </div>
  );
}
