import { Info, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, type SyntheticEvent, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { CARD_CLASS } from "~/components/ui/card.tsx";
import {
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { cn } from "~/lib/utils.ts";

const TITLE_SMALL_WORDS = new Set(["a", "an", "and", "by", "of", "or", "the"]);

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

function stopAtDialog(event: SyntheticEvent) {
	event.stopPropagation();
}

export function InfoTip({
	label,
	size = "sm",
	children,
}: {
	label: string;
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
						size === "default"
							? "-me-1.5 size-7 min-[400px]:-me-2.5"
							: "-m-1.25 size-6"
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
						className={cn(
							CARD_CLASS,
							MODAL_CARD_CLASS,
							"max-h-[80vh] max-w-md overflow-y-auto",
						)}
					>
						<div className="flex items-center justify-between gap-page">
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
