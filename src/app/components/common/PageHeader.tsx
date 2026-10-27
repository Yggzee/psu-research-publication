import React from "react";
import { Badge } from "../ui/badge";

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "success" | "warning" | "ai";
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function PageHeader({
  title,
  description,
  badge,
  badgeVariant = "outline",
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case "success":
        return "bg-success-soft text-success-foreground border-success-border";
      case "warning":
        return "bg-warning-soft text-warning-foreground border-warning-border";
      case "ai":
        return "bg-ai-soft text-ai-foreground border-ai-border";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-5 border-b border-border/70">
      <div className="space-y-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mb-1 overflow-x-auto no-scrollbar">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-foreground transition-colors shrink-0">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-foreground font-medium shrink-0">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {badge && (
            <Badge variant="outline" className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 ${getBadgeStyle()}`}>
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0 self-start sm:self-center pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
