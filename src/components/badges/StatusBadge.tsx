import type { ComponentType } from "react";

type StatusConfig = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
  ariaLabel?: string;
};

type Props = {
  config: StatusConfig;
  size?: "sm" | "md";
  className?: string;
};

export function StatusBadge({ config, size = "md", className = "" }: Props) {
  const Icon = config.icon;
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <span
      role="status"
      aria-label={config.ariaLabel ?? config.label}
      className={`inline-flex items-center rounded-full font-semibold ${config.badgeClass} ${sizeClass} ${className}`}
    >
      <Icon className={`${iconSize} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
}
