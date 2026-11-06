import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { useDraft } from "~/lib/use-draft.ts";
import { cn } from "~/lib/utils.ts";

export function parsePageInput(
	value: string,
	pageCount: number,
): number | null {
	const page = Number.parseInt(value.replace(/\D/g, ""), 10);
	if (Number.isNaN(page)) return null;
	return Math.min(Math.max(page, 1), Math.max(1, pageCount));
}

export function PageStepper({
	page,
	pageCount,
	onPageChange,
	label = "Pagination",
	variant = "outline",
	className,
}: {
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
	label?: string;
	variant?: "outline" | "ghost";
	className?: string;
}) {
	const [draft, setDraft] = useDraft(String(page));

	function commit() {
		const next = parsePageInput(draft, pageCount);
		if (next === null || next === page) {
			setDraft(String(page));
			return;
		}
		onPageChange(next);
	}

	const pageTotal = pageCount.toLocaleString();
	const shown = draft ? Number(draft).toLocaleString() : "";

	return (
		<nav
			aria-label={label}
			className={cn(
				"flex h-8 pointer-coarse:h-9 w-fit shrink-0 pointer-coarse:text-base text-sm max-[359px]:min-w-0 max-[359px]:shrink",
				variant === "outline" &&
					"overflow-hidden rounded-md border border-input bg-card focus-within:border-focus-ring",
				className,
			)}
		>
			<StepButton
				direction="prev"
				variant={variant}
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
			/>
			<label
				className="flex min-w-(--page-label-width) cursor-text items-center justify-center gap-[0.5ch] px-2 text-muted-foreground max-[359px]:min-w-0 max-[359px]:overflow-hidden"
				style={
					{
						"--page-label-width": `calc(${2 * numberWidth(pageTotal) + 2.4}ch + 1rem)`,
					} as React.CSSProperties
				}
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
					className="bg-transparent text-center font-semibold text-foreground tabular-nums underline-offset-4 outline-none hover:underline focus-visible:underline"
					style={{ width: `${numberWidth(shown || "0")}ch` }}
				/>
				<span className="whitespace-nowrap tabular-nums">of {pageTotal}</span>
			</label>
			<StepButton
				direction="next"
				variant={variant}
				disabled={page >= pageCount}
				onClick={() => onPageChange(page + 1)}
			/>
		</nav>
	);
}

export function PageRange({
	first,
	last,
	total,
	card = false,
	children,
	className,
}: {
	first: number;
	last: number;
	total?: { count: number; noun: [singular: string, plural: string] };
	card?: boolean;
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				PAGE_RANGE_CLASS,
				card && PAGE_RANGE_CARD_CLASS,
				!total && PAGE_RANGE_NARROW_HIDDEN,
				className,
			)}
		>
			<span>
				<span className="font-semibold text-foreground tabular-nums">
					{first.toLocaleString()}&ndash;{last.toLocaleString()}
				</span>
				{total ? (
					<>
						{" "}
						of{" "}
						<span className="font-semibold text-foreground tabular-nums">
							{total.count.toLocaleString()}
						</span>
						<span className="max-[400px]:hidden">
							{" "}
							{total.noun[total.count === 1 ? 0 : 1]}
						</span>
					</>
				) : null}
				{children}
			</span>
		</div>
	);
}

export const PAGE_ROW_CLASS =
	"flex min-w-0 flex-auto flex-wrap items-center gap-page";

export const PAGE_RANGE_NARROW_HIDDEN = "max-[359px]:hidden";

export const PAGE_RANGE_YIELDS_TO_ACTIONS = "@max-md:hidden";

export const PAGE_RANGE_CLASS =
	"flex h-8 pointer-coarse:h-9 min-w-0 items-center whitespace-nowrap text-muted-foreground text-sm";

export const PAGE_RANGE_CARD_CLASS =
	"rounded-md border border-input bg-card px-3";

function numberWidth(formatted: string): number {
	const digits = formatted.replace(/\D/g, "").length;
	return digits + (formatted.length - digits) * 0.45 + 0.1;
}

function StepButton({
	direction,
	variant,
	disabled,
	onClick,
}: {
	direction: "prev" | "next";
	variant: "outline" | "ghost";
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
			className={cn(
				"flex pointer-coarse:w-9 w-8 shrink-0 items-center justify-center hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
				variant === "outline"
					? cn("border-input", direction === "prev" ? "border-r" : "border-l")
					: "rounded-md border border-transparent text-muted-foreground hover:border-border",
			)}
		>
			<Icon className="size-4" aria-hidden="true" />
		</button>
	);
}
