import { Download, type LucideIcon, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";

// Import, Export and Reset as one joined control -- the pager's and the sort
// menu's box, border and card surface, a hairline between the segments --
// rather than three buttons a gap apart. Where the toolbar is under 30rem wide
// (a phone) each segment drops the word "lists" rather than shrinking, so the
// control keeps one line under the search; the aria-label keeps the full name.
const GROUP_CLASS =
	"flex h-8.5 pointer-coarse:h-9 w-fit shrink-0 overflow-hidden rounded-md border border-input bg-card pointer-coarse:text-base text-sm @min-[38rem]:self-auto self-start lg:ml-auto";
const SEGMENT_CLASS =
	"flex items-center gap-2 @max-[30rem]:px-3 px-3.5 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none [&+&]:border-input [&+&]:border-l";
const LISTS_WORD = "@max-[30rem]:hidden";

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
		<div className={GROUP_CLASS}>
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
			<Segment
				icon={Upload}
				verb="Import"
				onClick={() => inputRef.current?.click()}
			/>
			<Segment icon={Download} verb="Export" onClick={onExport} />
			<Segment icon={RotateCcw} verb="Reset" onClick={onReset} />
		</div>
	);
}

function Segment({
	icon: Icon,
	verb,
	onClick,
}: {
	icon: LucideIcon;
	verb: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={`${verb} lists`}
			className={SEGMENT_CLASS}
			onClick={onClick}
		>
			<Icon className="size-4 shrink-0" aria-hidden="true" />
			{/* One text box for the whole label, so the button's icon gap never
			    lands between the verb and "lists" on top of the space. */}
			<span>
				{verb}
				<span className={LISTS_WORD}> lists</span>
			</span>
		</button>
	);
}
