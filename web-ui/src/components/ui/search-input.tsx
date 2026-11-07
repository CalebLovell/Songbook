import { Search, X } from "lucide-react";
import type * as React from "react";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "~/components/ui/input.tsx";
import { useDraft } from "~/lib/use-draft.ts";
import { cn } from "~/lib/utils.ts";

const COMMIT_DELAY_MS = 200;

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
					className="absolute inset-y-0 right-0 flex pointer-coarse:w-9 w-8.5 items-center justify-center text-muted-foreground hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			) : null}
		</div>
	);
}

function DebouncedSearchInput({
	value,
	onCommit,
	...props
}: Omit<SearchInputProps, "onClear" | "onChange"> & {
	onCommit: (value: string) => void;
}) {
	const [draft, setDraft] = useDraft(value);
	const commitLater = useDebouncedCallback(onCommit, COMMIT_DELAY_MS);

	return (
		<SearchInput
			{...props}
			value={draft}
			onChange={(event) => {
				setDraft(event.target.value);
				commitLater(event.target.value);
			}}
			onClear={() => {
				setDraft("");
				commitLater.cancel();
				onCommit("");
			}}
		/>
	);
}

export { DebouncedSearchInput, SearchInput };
