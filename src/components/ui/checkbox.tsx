import type { ComponentProps } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "../../lib/utils";

export function Checkbox({ className, persistIndicator = false, ...props }: ComponentProps<typeof CheckboxPrimitive.Root> & {
  /** Keep selection layers mounted when the surface supplies reversible transitions. */
  persistIndicator?: boolean;
}) {
  return (
    <CheckboxPrimitive.Root {...props} className={cn("ui-checkbox", className)} data-slot="checkbox">
      <CheckboxPrimitive.Indicator forceMount={persistIndicator || undefined} className="ui-checkbox-indicator">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
