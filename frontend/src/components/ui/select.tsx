import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";


const ITEM_HEIGHT_PX = 36;
const VISIBLE_ITEMS = 4;
const VIEWPORT_MAX_HEIGHT_PX = ITEM_HEIGHT_PX * VISIBLE_ITEMS;

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-elevated/50 px-3.5 py-1 text-sm text-text transition-colors duration-150 outline-none",
        "data-[placeholder]:text-text-faint",
        "focus-visible:border-accent/60 focus-visible:ring-[3px] focus-visible:ring-accent/20",
        "aria-invalid:border-avoid/60 aria-invalid:ring-avoid/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "[&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-text-faint" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          style={{ maxHeight: VIEWPORT_MAX_HEIGHT_PX }}
          className="overflow-y-auto p-1"
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      style={{ height: ITEM_HEIGHT_PX }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-0 pl-8 pr-3 text-sm text-text-muted outline-none transition-colors duration-150",
        "focus:bg-bg data-[highlighted]:bg-bg data-[highlighted]:text-text",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-accent" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
