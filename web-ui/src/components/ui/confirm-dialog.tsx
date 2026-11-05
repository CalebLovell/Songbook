import { type LucideIcon, TriangleAlert, X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";

import { Button } from "~/components/ui/button.tsx";

export const MODAL_BACKDROP_CLASS =
	"fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] p-(--page-gap)";
export const MODAL_CARD_CLASS =
	"feature-card flex w-full flex-col gap-(--page-gap) rounded-md p-4 text-left shadow-xl";
export const MODAL_TITLE_CLASS = "font-semibold text-lg";
export const MODAL_ACTIONS_CLASS = "flex justify-end gap-(--page-gap)";

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
	const titleId = useId();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && !pending) onCancel();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onCancel, pending]);

	return (
		<div className={MODAL_BACKDROP_CLASS}>
			<section
				aria-labelledby={titleId}
				aria-modal="true"
				role="alertdialog"
				className={`${MODAL_CARD_CLASS} max-w-lg`}
			>
				<h2
					id={titleId}
					className={`${MODAL_TITLE_CLASS} flex items-center gap-(--page-gap)`}
				>
					{destructive ? (
						<TriangleAlert className="size-5 shrink-0 text-destructive" />
					) : null}
					{title}
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
				{children}
				<div className={MODAL_ACTIONS_CLASS}>
					<Button
						type="button"
						size="default"
						icon={cancelIcon}
						disabled={pending}
						variant="outline"
						onClick={onCancel}
					>
						{cancelLabel}
					</Button>
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
			</section>
		</div>
	);
}
