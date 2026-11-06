import { useQuery } from "@tanstack/react-query";
import { Check, Copy, RotateCw, Share2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { CARD_CLASS } from "~/components/ui/card.tsx";
import {
	MODAL_ACTIONS_CLASS,
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { ShellLines } from "~/components/ui/shell.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { cn } from "~/lib/utils.ts";

const COPIED_FEEDBACK_MS = 2_000;
const COPY_BUTTON_CLASS = "min-w-26";
const SUMMARY_SHELL_WIDTHS = [
	"w-1/3",
	"w-1/2",
	"w-1/3",
	"w-2/5",
	"w-1/2",
	"w-2/5",
	"w-3/5",
	"w-1/2",
];

// navigator.clipboard is undefined on a plain-HTTP LAN address, so the deprecated
// execCommand path is the only one that works there. The field goes inside the dialog
// because its focus trap would pull focus out of a field anywhere else.
async function copyText(
	text: string,
	container: HTMLElement,
): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {}
	}

	const focused = document.activeElement;
	const field = document.createElement("textarea");
	field.value = text;
	field.setAttribute("readonly", "");
	field.style.position = "fixed";
	field.style.opacity = "0";
	container.append(field);
	field.select();
	const copied = document.execCommand("copy");
	field.remove();
	if (focused instanceof HTMLElement) focused.focus();
	return copied;
}

function hasShareSheet(): boolean {
	return (
		typeof navigator.share === "function" &&
		window.matchMedia("(pointer: coarse)").matches
	);
}

type ShareSummary =
	| { status: "loading" }
	| { status: "ready"; text: string }
	| { status: "failed" };

export type ShareState = {
	isReady: boolean;
	summary: ShareSummary;
	retry: () => void;
};

export function useShare({
	subject,
	hasData,
	load,
}: {
	subject: string;
	hasData: boolean;
	load: () => Promise<string>;
}): ShareState {
	const {
		data: text,
		isError,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["share-summary", subject],
		queryFn: load,
		enabled: hasData,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 0,
	});

	let summary: ShareSummary = { status: "loading" };
	if (text !== undefined) summary = { status: "ready", text };
	else if (isError && !isFetching) summary = { status: "failed" };

	return {
		isReady: hasData || summary.status === "ready",
		summary,
		retry: () => void refetch(),
	};
}

function ShareDialogContent({ state }: { state: ShareState }) {
	const { summary } = state;
	const text = summary.status === "ready" ? summary.text : null;
	const contentRef = useRef<HTMLDivElement>(null);
	const primaryRef = useRef<HTMLButtonElement>(null);
	const [justCopied, setJustCopied] = useState(false);
	const [offerShareSheet] = useState(hasShareSheet);

	useEffect(() => {
		if (!justCopied) return;
		const timer = setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
		return () => clearTimeout(timer);
	}, [justCopied]);

	async function copy() {
		if (text === null || !contentRef.current) return;
		if (!(await copyText(text, contentRef.current))) {
			toast.error("Copying was blocked by the browser.");
			return;
		}
		setJustCopied(true);
		toast.success("Copied to clipboard");
	}

	async function openShareSheet() {
		if (text === null) return;
		try {
			await navigator.share({ text });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			toast.error("Could not open the share sheet.");
		}
	}

	return (
		<Dialog.Portal>
			<Dialog.Overlay className={MODAL_BACKDROP_CLASS}>
				<Dialog.Content
					ref={contentRef}
					aria-describedby={undefined}
					className={cn(CARD_CLASS, MODAL_CARD_CLASS, "max-h-full max-w-md")}
					onOpenAutoFocus={(event) => {
						const primary = primaryRef.current;
						if (!primary || primary.disabled) return;
						event.preventDefault();
						primary.focus();
					}}
				>
					<div className="flex items-center justify-between gap-page">
						<Dialog.Title className={MODAL_TITLE_CLASS}>
							Share Summary
						</Dialog.Title>
						<Dialog.Close asChild>
							<Button
								type="button"
								variant="outline"
								size="icon"
								icon={X}
								aria-label="Close"
							/>
						</Dialog.Close>
					</div>

					<div
						data-testid="share-preview"
						aria-busy={summary.status === "loading"}
						className="min-h-0 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-meadow p-page text-sm leading-relaxed"
					>
						{summary.status === "ready" && summary.text}
						{summary.status === "loading" && (
							<ShellLines widths={SUMMARY_SHELL_WIDTHS} />
						)}
						{summary.status === "failed" && (
							<span className="text-muted-foreground">
								Could not build the summary.
							</span>
						)}
					</div>

					<div className={MODAL_ACTIONS_CLASS}>
						{summary.status === "failed" ? (
							<Button
								type="button"
								size="default"
								icon={RotateCw}
								onClick={state.retry}
							>
								Try again
							</Button>
						) : (
							<>
								<Button
									ref={offerShareSheet ? undefined : primaryRef}
									type="button"
									size="default"
									variant={offerShareSheet ? "outline" : "default"}
									icon={justCopied ? Check : Copy}
									loading={text === null}
									onClick={copy}
									className={COPY_BUTTON_CLASS}
								>
									{justCopied ? "Copied" : "Copy"}
								</Button>
								{offerShareSheet && (
									<Button
										ref={primaryRef}
										type="button"
										size="default"
										icon={Share2}
										loading={text === null}
										onClick={openShareSheet}
									>
										Share
									</Button>
								)}
							</>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Overlay>
		</Dialog.Portal>
	);
}

export function ShareButton({
	state,
	shape = "pill",
	className,
}: {
	state: ShareState;
	shape?: "pill" | "plain";
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>
				<Button
					variant="outline"
					size={shape === "pill" ? "lg" : "default"}
					icon={Share2}
					disabled={!state.isReady}
					className={cn(
						shape === "pill" &&
							"h-8 self-center rounded-full px-4 text-moss hover:border-hover-line hover:bg-icon-well hover:text-moss [&_svg]:size-5!",
						className,
					)}
				>
					Share
				</Button>
			</Dialog.Trigger>
			{open && <ShareDialogContent state={state} />}
		</Dialog.Root>
	);
}
