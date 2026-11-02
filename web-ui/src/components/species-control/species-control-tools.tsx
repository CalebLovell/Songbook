import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "~/components/ui/button.tsx";

// The toolbar's 36px buttons, at every width. On the smallest phones (under
// 400px, where the page gap halves too) each drops the word "lists" rather
// than shrinking, so all three still share one line under the search; the
// aria-label keeps the full name.
const TOOL_BUTTON = "h-9 max-[400px]:px-3";
const LISTS_WORD = "max-[400px]:hidden";

export function SpeciesControlTools({
	onImport,
	onExport,
	onReset,
}: {
	onImport: (text: string) => void;
	onExport: () => void;
	onReset: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="flex shrink-0 flex-wrap @min-[38rem]:justify-end gap-2 lg:ml-auto">
			<input
				ref={inputRef}
				className="sr-only"
				type="file"
				accept=".txt,.json,text/plain,application/json"
				onChange={async (event) => {
					const file = event.target.files?.[0];
					if (file) onImport(await file.text());
					event.target.value = "";
				}}
			/>
			<Button
				className={TOOL_BUTTON}
				size="default"
				variant="outline"
				aria-label="Import lists"
				onClick={() => inputRef.current?.click()}
			>
				<Upload />
				Import<span className={LISTS_WORD}> lists</span>
			</Button>
			<Button
				className={TOOL_BUTTON}
				size="default"
				variant="outline"
				aria-label="Export lists"
				onClick={onExport}
			>
				<Download />
				Export<span className={LISTS_WORD}> lists</span>
			</Button>
			<Button
				className={TOOL_BUTTON}
				size="default"
				variant="outline"
				aria-label="Reset lists"
				onClick={onReset}
			>
				<RotateCcw />
				Reset<span className={LISTS_WORD}> lists</span>
			</Button>
		</div>
	);
}
