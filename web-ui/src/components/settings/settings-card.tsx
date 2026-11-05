import { RotateCcw, Save, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { settingsCardId } from "./settings-index.ts";

const DEFAULT_CONFIRM_DESCRIPTION =
	"This writes the values in this card to the station's configuration and restarts BirdNET so they take effect, which interrupts recording for a moment. Other cards are left as they are.";

export const RESET_RESTARTS_DESCRIPTION =
	"Every value in this card goes back to what a fresh install writes, and any edits you haven't saved are dropped. BirdNET restarts so they take effect, which interrupts recording for a moment. Other cards are left as they are.";

export function SettingsCard({
	title,
	description,
	onSave,
	confirmDescription = DEFAULT_CONFIRM_DESCRIPTION,
	reset,
	restart,
	saveDisabled,
	children,
}: {
	title: string;
	description: string;
	onSave: () => void;
	confirmDescription?: string;
	reset?: { onReset: () => void; disabled: boolean; description: string };
	restart?: ReactNode;
	saveDisabled?: boolean;
	children: ReactNode;
}) {
	const [confirming, setConfirming] = useState(false);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const cardId = settingsCardId(title);
	const headingId = `settings-${cardId}`;

	return (
		<Card
			as="section"
			id={cardId}
			aria-labelledby={headingId}
			className="scroll-mt-4"
		>
			<form
				className="flex h-full flex-col"
				onSubmit={(event) => {
					event.preventDefault();
					setConfirming(true);
				}}
			>
				<CardHeader as="h2" titleId={headingId} title={title} />

				<p className="py-page text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>

				<div className="flex-1">{children}</div>

				<div className="-mx-page flex flex-wrap items-center gap-page border-t px-page pt-page">
					{reset ? (
						<Button
							type="button"
							variant="outline"
							size="default"
							icon={RotateCcw}
							disabled={reset.disabled}
							onClick={() => setConfirmingReset(true)}
						>
							Reset these settings
						</Button>
					) : null}
					<div className="ml-auto flex flex-wrap items-center justify-end gap-page">
						{restart}
						<Button
							type="submit"
							size="default"
							icon={Save}
							disabled={saveDisabled}
						>
							Save
						</Button>
					</div>
				</div>
			</form>

			{confirming ? (
				<ConfirmDialog
					title={`Save ${title.toLowerCase()} settings?`}
					description={confirmDescription}
					confirmLabel="Save changes"
					confirmIcon={Save}
					onCancel={() => setConfirming(false)}
					onConfirm={() => {
						setConfirming(false);
						onSave();
					}}
				/>
			) : null}

			{confirmingReset && reset ? (
				<ConfirmDialog
					title={`Reset ${title.toLowerCase()} settings?`}
					description={reset.description}
					cancelIcon={X}
					confirmIcon={RotateCcw}
					confirmLabel="Reset these settings"
					destructive
					onCancel={() => setConfirmingReset(false)}
					onConfirm={() => {
						setConfirmingReset(false);
						reset.onReset();
					}}
				/>
			) : null}
		</Card>
	);
}
