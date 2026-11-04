import { Search, X } from "lucide-react";
import type * as React from "react";

import { Input } from "~/components/ui/input.tsx";
import { cn } from "~/lib/utils.ts";

type SearchInputProps = Omit<React.ComponentProps<"input">, "value"> & {
	value: string;
	onClear: () => void;
};

function SearchInput({
	className,
	value,
	onClear,
	...props
}: SearchInputProps) {
	return (
		<div className={cn("relative w-full min-w-0 flex-1", className)}>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input type="text" value={value} className="pr-9 pl-9" {...props} />
			{value ? (
				<button
					type="button"
					aria-label="Clear search"
					onClick={onClear}
					className="absolute inset-y-0 right-0 flex pointer-coarse:w-9 w-8.5 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			) : null}
		</div>
	);
}

export { SearchInput };
