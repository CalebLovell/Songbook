import { X } from "lucide-react";
import type { ReactNode } from "react";

import { JOINED_CONTROL_CLASS } from "~/components/ui/joined-control.ts";
import { cn } from "~/lib/utils.ts";

export function SelectionBar({
	label,
	count,
	onClear,
	className,
	children,
}: {
	label: string;
	count: number;
	onClear: () => void;
	className?: string;
	children: ReactNode;
}) {
	return (
		<fieldset
			aria-label={label}
			className={cn(
				JOINED_CONTROL_CLASS,
				"h-8 pointer-coarse:h-9 w-fit text-sm",
				className,
			)}
		>
			<span className="flex items-center gap-[0.5ch] @xl:px-3 px-2 text-muted-foreground">
				<span className="font-semibold text-foreground tabular-nums">
					{count}
				</span>
				<span className="sr-only @xl:not-sr-only">selected</span>
			</span>
			<button
				type="button"
				aria-label="Clear selection"
				title="Clear selection"
				onClick={onClear}
				className="flex pointer-coarse:w-9 w-8 shrink-0 items-center justify-center border-input border-l text-muted-foreground hover:bg-accent hover:text-accent-foreground"
			>
				<X className="size-4" aria-hidden="true" />
			</button>
			{children}
		</fieldset>
	);
}
