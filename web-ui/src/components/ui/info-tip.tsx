import { Info, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, type SyntheticEvent, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import {
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";

/** Words a title leaves lowercase, unless one comes first. */
const TITLE_SMALL_WORDS = new Set(["a", "an", "and", "by", "of", "or", "the"]);

/** "Detections by hour" as a title: "Detections by Hour". Hyphens split words
    too, so "Species-frequency" reads "Species-Frequency". */
function titleCase(label: string) {
	return label
		.split(/([\s-]+)/)
		.map((word, index) =>
			index > 0 && TITLE_SMALL_WORDS.has(word)
				? word
				: word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join("");
}

/** The dialog is portalled out of the page's DOM but not out of its React
    tree, so its events would still reach the card, table header or label the
    icon sits in, and its keys the page's own shortcuts. */
function stopAtDialog(event: SyntheticEvent) {
	event.stopPropagation();
}

/**
 * An explanation a reader can ask for, so a control can stay uncluttered
 * without going unexplained -- the info icon every explanation in the app goes
 * through. Hovering only outlines the icon, like any outline button; clicking
 * or tapping opens the explanation in a centered modal over the dimmed page,
 * until the close button, a click outside it or Escape lets it go.
 *
 * The click's default is prevented because the icon sometimes sits inside a
 * field's label, which would otherwise pull focus into the control it labels;
 * that is also why the dialog is opened here rather than by its trigger, which
 * stands aside for a prevented click.
 */
export function InfoTip({
	label,
	size = "sm",
	children,
}: {
	/** What's being explained, in sentence case: the modal's title sets it in
	    title case and adds "Information". */
	label: string;
	/** `default` is a 16px glyph on a 28px target for a card's header, pulled
	    out so the glyph sits 12px from the card's edge; `sm` is a 14px glyph on
	    a 24px target for a field's label, pulled out so the outline takes up no
	    room in the line. */
	size?: "sm" | "default";
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>
				<button
					type="button"
					aria-label={`About ${label}`}
					className={`inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground ${
						size === "default" ? "-me-2.5 size-7" : "-m-1.25 size-6"
					}`}
					onClick={(event) => {
						event.preventDefault();
						setOpen(true);
					}}
				>
					<Info className={size === "default" ? "size-4" : "size-3.5"} />
				</button>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay
					className={MODAL_BACKDROP_CLASS}
					onClick={stopAtDialog}
					onKeyDown={stopAtDialog}
				>
					<Dialog.Content
						aria-describedby={undefined}
						className={`${MODAL_CARD_CLASS} max-h-[80vh] max-w-md overflow-y-auto`}
					>
						<div className="flex items-center justify-between gap-(--page-gap)">
							<Dialog.Title className={MODAL_TITLE_CLASS}>
								{titleCase(label)} Information
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
						<div className="space-y-2 text-sm leading-relaxed">{children}</div>
					</Dialog.Content>
				</Dialog.Overlay>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
