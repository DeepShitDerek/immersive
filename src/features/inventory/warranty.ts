import { addMonths, isAfter } from "date-fns";
import { AlertCircle, CheckCircle2, X, type LucideIcon } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";

export interface WarrantyStatus {
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

export function getWarrantyStatus(expiryDate?: string | null): WarrantyStatus {
  if (!expiryDate)
    return {
      label: "No warranty",
      color: "text-muted-foreground",
      bg: "bg-secondary",
      icon: X,
    };
  const expiry = parseLocalDate(expiryDate);
  const now = new Date();
  const warningZone = addMonths(now, 1);

  if (isAfter(now, expiry)) {
    return {
      // A lapsed warranty is a fact, not an alarm: nothing can be done
      // about it now. The danger colour is for things that need you.
      label: "Expired",
      color: "text-muted-foreground",
      bg: "bg-secondary",
      icon: AlertCircle,
    };
  }
  if (isAfter(warningZone, expiry)) {
    return {
      label: "Expiring soon",
      color: "text-warning",
      bg: "bg-warning/10",
      icon: AlertCircle,
    };
  }
  return {
    label: "Active",
    color: "text-success",
    bg: "bg-success/10",
    icon: CheckCircle2,
  };
}
