import React from "react";
import { Card, CardHeader, CardContent } from "../ui/card";

export interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  contentClassName = "",
}: SectionCardProps) {
  return (
    <Card className={`bg-card border-border/70 shadow-2xs rounded-xl overflow-hidden ${className}`}>
      <CardHeader className="p-3.5 sm:p-5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 space-y-0">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0 self-start sm:self-auto w-full sm:w-auto">{action}</div>}
      </CardHeader>
      <CardContent className={`p-3.5 sm:p-5 ${contentClassName}`}>
        {children}
      </CardContent>
    </Card>
  );
}
