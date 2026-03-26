"use client";

import { cn } from "@/lib/utils";

interface ShieldIconProps {
  status: "idle" | "scanning" | "authentic" | "uncertain" | "deepfake";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animated?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
};

const statusColors = {
  idle: "text-muted-foreground",
  scanning: "text-shield-blue",
  authentic: "text-shield-green",
  uncertain: "text-shield-yellow",
  deepfake: "text-shield-red",
};

const glowClasses = {
  idle: "",
  scanning: "drop-shadow-[0_0_20px_var(--shield-blue-glow)]",
  authentic: "drop-shadow-[0_0_25px_var(--shield-green-glow)]",
  uncertain: "drop-shadow-[0_0_25px_var(--shield-yellow-glow)]",
  deepfake: "drop-shadow-[0_0_30px_var(--shield-red-glow)]",
};

export function ShieldIcon({
  status,
  size = "md",
  className,
  animated = true,
}: ShieldIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        sizeClasses[size],
        statusColors[status],
        glowClasses[status],
        animated && status === "scanning" && "animate-pulse",
        animated && status === "deepfake" && "animate-[pulse_0.5s_ease-in-out_infinite]",
        "transition-all duration-500",
        className
      )}
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill="currentColor"
        fillOpacity={0.2}
      />
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {status === "authentic" && (
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[draw_0.5s_ease-out_forwards]"
        />
      )}
      {status === "deepfake" && (
        <>
          <line
            x1="12"
            y1="8"
            x2="12"
            y2="12"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx="12" cy="15" r="1" fill="currentColor" />
        </>
      )}
      {status === "uncertain" && (
        <text
          x="12"
          y="14"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8"
          fontWeight="bold"
        >
          ?
        </text>
      )}
    </svg>
  );
}
