import React from "react";
import { Badge } from "../ui/badge";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function PageTabs({ tabs, activeTab, onChange, className = "" }: PageTabsProps) {
  return (
    <div className={`border-b border-border/70 overflow-x-auto no-scrollbar scroll-smooth -mx-1 px-1 ${className}`}>
      <div className="flex items-center gap-1 sm:gap-2 pb-px min-w-max">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
                isActive
                  ? "border-brand text-brand font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {Icon && <Icon className={`w-4 h-4 ${isActive ? "text-brand" : "text-muted-foreground"}`} />}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive
                      ? "bg-brand/10 text-brand font-bold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    isActive ? "border-brand/40 text-brand" : "text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
