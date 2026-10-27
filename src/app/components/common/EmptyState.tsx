import React from "react";
import { Button } from "../ui/button";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground shadow-2xs">
          <Icon className="w-6 h-6 opacity-75" />
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm sm:text-base font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button size="sm" onClick={onAction} className="text-xs h-8">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
