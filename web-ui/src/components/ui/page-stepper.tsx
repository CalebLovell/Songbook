import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils.ts";

/**
 * The page a typed entry asks for, held to the pages that exist -- or null when
 * it names no page at all, so the field can fall back to the current one.
 */
export function parsePageInput(
	value: string,
	pageCount: number,
): number | null {
	const page = Number.parseInt(value.replace(/\D/g, ""), 10);
	if (Number.isNaN(page)) return null;
	return Math.min(Math.max(page, 1), Math.max(1, pageCount));
}

/**
 * Paging as one bordered control, built like the detections date range and the
 * timeline's window stepper: segments joined by hairlines rather than a row of
 * loose buttons: the step back, the page itself, and the step forward.
 *
 * The page is a field, not a label: type any page and Enter (or leaving the
 * field) goes there, clamped to the pages that exist; Escape puts back the
 * current one. A list of every page would be 2,788 options on a busy station.
 *
 * The height of the search box, date range and sort menu, so a
 * table's footer carries controls the same size as the ones above it. The
 * page field's type goes up to 16px under a finger, as every field's does, so
 * a phone doesn't zoom in on it.
 */
export function PageStepper({
	page,
	pageCount,
	onPageChange,
	label = "Pagination",
	className,
}: {
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
	label?: string;
	className?: string;
}) {
	const [draft, setDraft] = useState(String(page));
	useEffect(() => setDraft(String(page)), [page]);

	function commit() {
		const next = parsePageInput(draft, pageCount);
		if (next === null || next === page) {
			setDraft(String(page));
			return;
		}
		onPageChange(next);
	}

	// The page reads as plain text -- "1 of 1,394" -- with no box around the
	// number. The field is exactly as wide as the number in it, so the words
	// always sit together, and the whole line centres in its segment. The
	// segment's floor is that line at its widest, so paging never moves the
	// arrows. Widths are counted rather than measured: `tabular-data` pins each
	// digit to 1ch, a group separator is under half that, and "of" with its
	// spaces is about 2.4ch.
	const pageTotal = pageCount.toLocaleString();
	// The field holds bare digits while it is edited and shows them grouped
	// like any other number ("1,394"), matching the total beside it.
	const shown = draft ? Number(draft).toLocaleString() : "";

	return (
		<nav
			aria-label={label}
			className={cn(
				"flex h-8 pointer-coarse:h-9 w-fit shrink-0 overflow-hidden rounded-md border border-input bg-card pointer-coarse:text-base text-sm focus-within:border-[var(--focus-ring)]",
				className,
			)}
		>
			<StepButton
				direction="prev"
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
			/>
			<label
				className="flex cursor-text items-center justify-center gap-[0.5ch] px-3 text-muted-foreground"
				style={{
					minWidth: `calc(${2 * numberWidth(pageTotal) + 2.4}ch + 1.5rem)`,
				}}
			>
				<input
					aria-label={`Page, of ${pageTotal}`}
					inputMode="numeric"
					value={shown}
					onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
					onBlur={commit}
					onFocus={(event) => event.currentTarget.select()}
					onKeyDown={(event) => {
						if (event.key === "Enter") commit();
						if (event.key === "Escape") setDraft(String(page));
					}}
					className="tabular-data bg-transparent text-center font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
					style={{ width: `${numberWidth(shown || "0")}ch` }}
				/>
				<span className="tabular-data whitespace-nowrap">of {pageTotal}</span>
			</label>
			<StepButton
				direction="next"
				disabled={page >= pageCount}
				onClick={() => onPageChange(page + 1)}
			/>
		</nav>
	);
}

/**
 * The stepper's partner at the other end of a footer: which rows the page
 * holds, as bare text at the stepper's height rather than in a box of its own,
 * so it fits beside the pager on the narrowest phone. A table's footer gives
 * just the rows ("1–50") -- the stepper beside it already says how far the
 * pages run; a footer that needs it adds the total and a noun ("1–24 of 78
 * species").
 */
export function PageRange({
	first,
	last,
	total,
	children,
	className,
}: {
	first: number;
	last: number;
	/** The total and its noun -- the singular used when the total is one. */
	total?: { count: number; noun: [singular: string, plural: string] };
	/** Anything said after the range, like what a search filtered it from. */
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn(PAGE_RANGE_CLASS, className)}>
			<span>
				<span className="tabular-data font-semibold text-foreground">
					{first.toLocaleString()}&ndash;{last.toLocaleString()}
				</span>
				{total ? (
					<>
						{" "}
						of{" "}
						<span className="tabular-data font-semibold text-foreground">
							{total.count.toLocaleString()}
						</span>{" "}
						{total.noun[total.count === 1 ? 0 : 1]}
					</>
				) : null}
				{children}
			</span>
		</div>
	);
}

/**
 * A table footer's range and stepper held together, so when the footer wraps
 * around a selection's actions the two stay on one row under them. Sized from
 * its content (`flex-auto`, not `flex-1`'s zero basis) so it drops below the
 * actions whole rather than squeezing in beside them; it grows into the row's
 * spare width with the stepper pushed right. Under 360px, where the pair at
 * its widest ("83,401–83,452" beside "835 of 835") no longer fits a row, the
 * two stack centred instead of the stepper wrapping off to the right alone.
 */
export const PAGE_ROW_CLASS =
	"flex min-w-0 flex-auto flex-wrap items-center gap-(--page-gap) max-[359px]:flex-col max-[359px]:*:mx-auto";

/** PageRange's line, for a loading shell to hold the same shape. */
export const PAGE_RANGE_CLASS =
	"flex h-8 pointer-coarse:h-9 min-w-0 items-center whitespace-nowrap text-muted-foreground text-sm";

/**
 * How wide a formatted number sets in `tabular-data`, in ch: a full ch per
 * digit and a little under half one per separator, plus a hair of slack so the
 * field never clips its own last digit.
 */
function numberWidth(formatted: string): number {
	const digits = formatted.replace(/\D/g, "").length;
	return digits + (formatted.length - digits) * 0.45 + 0.1;
}

/** One end of the stepper, divided from the page by a hairline. */
function StepButton({
	direction,
	disabled,
	onClick,
}: {
	direction: "prev" | "next";
	disabled: boolean;
	onClick: () => void;
}) {
	const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
	const label = direction === "prev" ? "Previous page" : "Next page";
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className={`flex pointer-coarse:w-9 w-8 shrink-0 items-center justify-center border-input transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${direction === "prev" ? "border-r" : "border-l"}`}
		>
			<Icon className="size-4" aria-hidden="true" />
		</button>
	);
}
