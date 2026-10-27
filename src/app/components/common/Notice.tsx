import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles, X } from "lucide-react";

export type NoticeVariant = "success" | "warning" | "danger" | "info" | "ai";

export interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Notice({
  variant = "info",
  title,
  children,
  icon: CustomIcon,
  action,
  onDismiss,
  className = "",
}: NoticeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return {
          container: "bg-success-soft border-success-border text-success-foreground",
          icon: CheckCircle2,
          iconColor: "text-success",
        };
      case "warning":
        return {
          container: "bg-warning-soft border-warning-border text-warning-foreground",
          icon: AlertTriangle,
          iconColor: "text-warning",
        };
      case "danger":
        return {
          container: "bg-danger-soft border-danger-border text-danger-foreground",
          icon: AlertCircle,
          iconColor: "text-danger",
        };
      case "ai":
        return {
          container: "bg-ai-soft border-ai-border text-ai-foreground",
          icon: Sparkles,
          iconColor: "text-ai",
        };
      case "info":
      default:
        return {
          container: "bg-info-soft border-info-border text-info-foreground",
          icon: Info,
          iconColor: "text-info",
        };
    }
  };

  const { container, icon: DefaultIcon, iconColor } = getVariantStyles();
  const Icon = CustomIcon || DefaultIcon;

  return (
    <div
      role="alert"
      className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm leading-relaxed transition-all ${container} ${className}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold mb-0.5 leading-snug">{title}</h5>}
        <div className="opacity-95">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-opacity"
          aria-label="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
