import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-lg border border-border bg-bg-elevated/50 px-3.5 py-1 text-sm text-text transition-colors duration-150 outline-none",
        "placeholder:text-text-faint",
        "focus-visible:border-accent/60 focus-visible:ring-[3px] focus-visible:ring-accent/20",
        "aria-invalid:border-avoid/60 aria-invalid:ring-avoid/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text",
        className
      )}
      {...props}
    />
  );
}

export { Input };
