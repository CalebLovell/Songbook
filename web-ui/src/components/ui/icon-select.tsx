import { ChevronDown } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "~/lib/utils.ts";

export function IconSelect<Value extends string>({
	icon: Icon,
	label,
	value,
	options,
	onChange,
	iconHiddenWhenNarrow = false,
	className,
}: {
	icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
	label: string;
	value: Value;
	options: readonly { value: Value; label: string }[];
	onChange: (value: Value) => void;
	iconHiddenWhenNarrow?: boolean;
	className?: string;
}) {
	return (
		<div className={cn("relative shrink-0", className)}>
			<Icon
				className={cn(
					"pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2",
					iconHiddenWhenNarrow && "max-[400px]:hidden",
				)}
				aria-hidden="true"
			/>
			<select
				aria-label={label}
				value={value}
				onChange={(event) => onChange(event.target.value as Value)}
				className={cn(
					"h-8.5 pointer-coarse:h-9 cursor-pointer appearance-none rounded-md border border-input bg-card pr-7 pl-8 font-medium pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-focus-ring focus-visible:outline-none",
					iconHiddenWhenNarrow && "max-[400px]:pl-2.5",
				)}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<ChevronDown
				className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
		</div>
	);
}
