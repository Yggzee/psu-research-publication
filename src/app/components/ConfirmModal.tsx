import React from "react";
import { AlertTriangle, LogOut, Trash2, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  icon?: "logout" | "trash" | "warning" | "question";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (icon) {
      case "logout":
        return <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />;
      case "trash":
        return <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      default:
        return <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getIconBg = () => {
    if (variant === "danger") return "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50";
    if (variant === "warning") return "bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50";
    return "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50";
  };

  const getConfirmButtonClass = () => {
    if (variant === "danger") {
      return "bg-red-600 hover:bg-red-700 text-white shadow-sm";
    }
    if (variant === "warning") {
      return "bg-amber-600 hover:bg-amber-700 text-white shadow-sm";
    }
    return "bg-blue-600 hover:bg-blue-700 text-white shadow-sm";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-card p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${getIconBg()}`}>
            {renderIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-accent"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            className={getConfirmButtonClass()}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
