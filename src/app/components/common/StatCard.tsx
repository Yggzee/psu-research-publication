import React from "react";
import { Card, CardContent } from "../ui/card";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  onClick,
  className = "",
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Card
      onClick={onClick}
      className={`p-3 sm:p-4 bg-card border-border/70 shadow-2xs rounded-xl transition-all ${
        isClickable
          ? "cursor-pointer hover:border-brand/40 hover:shadow-xs active:scale-[0.99]"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground line-clamp-1">{label}</span>
        {Icon && (
          <div className="p-1.5 sm:p-2 rounded-lg bg-muted/40 text-brand shrink-0">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>

      <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {trend && (
          <span
            className={`text-[10px] sm:text-xs font-semibold ${
              trend.isPositive
                ? "text-success-foreground bg-success-soft px-1.5 py-0.5 rounded"
                : "text-muted-foreground"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
      )}
    </Card>
  );
}
