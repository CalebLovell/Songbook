import type { ComponentProps } from "react";

import { cn } from "~/lib/utils.ts";

export const COUNT_CLASS = "font-bold text-[13px] text-foreground tabular-nums";

export function Count({ className, ...props }: ComponentProps<"span">) {
	return (
		<span {...props} data-slot="count" className={cn(COUNT_CLASS, className)} />
	);
}
