import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

import { CARD_CLASS } from "~/components/ui/card.tsx";
import {
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { useReturnFocus } from "~/lib/use-return-focus.ts";
import { cn } from "~/lib/utils.ts";

export function ModalDialog({
	title,
	className,
	onClose,
	children,
}: {
	title: string;
	className?: string;
	onClose: () => void;
	children: ReactNode;
}) {
	useReturnFocus();

	return (
		<Dialog.Root
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Dialog.Overlay className={MODAL_BACKDROP_CLASS}>
				<Dialog.Content
					aria-describedby={undefined}
					className={cn(CARD_CLASS, MODAL_CARD_CLASS, className)}
				>
					<Dialog.Title className={MODAL_TITLE_CLASS}>{title}</Dialog.Title>
					{children}
				</Dialog.Content>
			</Dialog.Overlay>
		</Dialog.Root>
	);
}
