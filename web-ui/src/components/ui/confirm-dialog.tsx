import { type LucideIcon, TriangleAlert, X } from "lucide-react";
import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

import { Button } from "~/components/ui/button.tsx";
import { CARD_CLASS } from "~/components/ui/card.tsx";
import { useReturnFocus } from "~/lib/use-return-focus.ts";
import { cn } from "~/lib/utils.ts";

export const MODAL_BACKDROP_CLASS =
	"fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--shade)_28%,transparent)] p-page";
export const MODAL_CARD_CLASS =
	"flex w-full flex-col gap-page text-left shadow-xl";
export const MODAL_TITLE_CLASS = "font-semibold text-lg";
export const MODAL_ACTIONS_CLASS = "flex justify-end gap-page";

export function ConfirmDialog({
	title,
	description,
	children,
	confirmLabel,
	cancelLabel = "Cancel",
	cancelIcon = X,
	confirmIcon,
	destructive = false,
	pending = false,
	onCancel,
	onConfirm,
}: {
	title: string;
	description: string;
	children?: ReactNode;
	confirmLabel: string;
	cancelLabel?: string;
	cancelIcon?: LucideIcon;
	confirmIcon: LucideIcon;
	destructive?: boolean;
	pending?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	useReturnFocus();

	return (
		<AlertDialog.Root
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<AlertDialog.Overlay className={MODAL_BACKDROP_CLASS}>
				<AlertDialog.Content
					onEscapeKeyDown={(event) => {
						if (pending) event.preventDefault();
					}}
					className={cn(CARD_CLASS, MODAL_CARD_CLASS, "max-w-lg")}
				>
					<AlertDialog.Title
						className={`${MODAL_TITLE_CLASS} flex items-center gap-page`}
					>
						{destructive ? (
							<TriangleAlert
								aria-hidden="true"
								className="size-5 shrink-0 text-destructive"
							/>
						) : null}
						{title}
					</AlertDialog.Title>
					<AlertDialog.Description className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</AlertDialog.Description>
					{children}
					<div className={MODAL_ACTIONS_CLASS}>
						<AlertDialog.Cancel asChild>
							<Button
								type="button"
								size="default"
								icon={cancelIcon}
								disabled={pending}
								variant="outline"
							>
								{cancelLabel}
							</Button>
						</AlertDialog.Cancel>
						<Button
							type="button"
							size="default"
							icon={confirmIcon}
							loading={pending}
							variant={destructive ? "destructive" : "default"}
							onClick={onConfirm}
						>
							{confirmLabel}
						</Button>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Overlay>
		</AlertDialog.Root>
	);
}
