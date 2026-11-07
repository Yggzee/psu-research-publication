import React from "react";
import { Badge } from "../ui/badge";

export type StatusType =
  | "approved"
  | "pending"
  | "rejected"
  | "verified"
  | "unverified"
  | "active"
  | "inactive"
  | "published"
  | "unpublished"
  | "in-progress"
  | "synced"
  | "failed"
  | "ai"
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  label,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  const norm = (status || "").toLowerCase().trim();

  let style = "bg-muted text-muted-foreground border-border";
  let defaultLabel = status;
  let dotColor = "bg-muted-foreground";

  // Success role: Approved, verified, active, published, synced, faculty
  if (["approved", "verified", "active", "published", "synced", "delivered", "faculty"].includes(norm)) {
    style = "bg-success-soft text-success-foreground border-success-border";
    dotColor = "bg-success";
    defaultLabel = norm.charAt(0).toUpperCase() + norm.slice(1);
  }
  // Role badges: Research Coordinator & Researcher
  else if (norm === "admin") {
    style = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    dotColor = "bg-amber-500";
    defaultLabel = "Research Coordinator";
  }
  else if (norm === "instructor" || norm === "researcher") {
    style = "bg-brand-soft text-brand border-brand/30";
    dotColor = "bg-brand";
    defaultLabel = "Researcher";
  }
  else if (norm === "non-faculty" || norm === "non teaching" || norm === "non-teaching") {
    style = "bg-muted/70 text-muted-foreground border-border";
    dotColor = "bg-muted-foreground";
    defaultLabel = "Non-Faculty";
  }
  // Warning role: Pending, in-progress, awaiting
  else if (["pending", "in-progress", "in progress", "awaiting", "expiring"].includes(norm)) {
    style = "bg-warning-soft text-warning-foreground border-warning-border";
    dotColor = "bg-warning";
    defaultLabel = norm === "in-progress" || norm === "in progress" ? "In Progress" : "Pending";
  }
  // Danger role: Rejected, failed, unverified, inactive, declined
  else if (["rejected", "declined", "failed", "unverified", "inactive"].includes(norm)) {
    style = "bg-danger-soft text-danger-foreground border-danger-border";
    dotColor = "bg-danger";
    defaultLabel = norm.charAt(0).toUpperCase() + norm.slice(1);
  }
  // AI role: AI tagged, Gemini
  else if (["ai", "gemini", "classified"].includes(norm)) {
    style = "bg-ai-soft text-ai-foreground border-ai-border";
    dotColor = "bg-ai";
    defaultLabel = "AI Verified";
  }
  // Info role: Unpublished, draft
  else if (["unpublished", "draft"].includes(norm)) {
    style = "bg-muted/70 text-muted-foreground border-border";
    dotColor = "bg-muted-foreground";
    defaultLabel = "Unpublished";
  }

  const sizeClasses = size === "sm" ? "text-[11px] px-2 py-0.5 gap-1.5" : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <Badge
      variant="outline"
      className={`font-medium inline-flex items-center rounded-md border ${sizeClasses} ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label || defaultLabel}</span>
    </Badge>
  );
}
