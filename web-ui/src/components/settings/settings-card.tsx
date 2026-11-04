import { Save } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { settingsCardId } from "./settings-index.ts";

const DEFAULT_CONFIRM_DESCRIPTION =
	"This writes the values in this card to the station's configuration and restarts BirdNET so they take effect, which interrupts recording for a moment. Other cards are left as they are.";

export function SettingsCard({
	title,
	description,
	onSave,
	confirmDescription = DEFAULT_CONFIRM_DESCRIPTION,
	restart,
	saveDisabled,
	children,
}: {
	title: string;
	description: string;
	onSave: () => void;
	confirmDescription?: string;
	restart?: ReactNode;
	saveDisabled?: boolean;
	children: ReactNode;
}) {
	const [confirming, setConfirming] = useState(false);
	const cardId = settingsCardId(title);
	const headingId = `settings-${cardId}`;

	return (
		<section
			id={cardId}
			aria-labelledby={headingId}
			className="feature-card scroll-mt-4 rounded-md p-4"
		>
			<form
				className="flex h-full flex-col"
				onSubmit={(event) => {
					event.preventDefault();
					setConfirming(true);
				}}
			>
				<CardHeader as="h2" titleId={headingId} title={title} />

				<p className="py-(--page-gap) text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>

				<div className="flex-1">{children}</div>

				<div className="-mx-(--page-gap) flex flex-wrap items-center justify-start gap-2 border-t px-(--page-gap) pt-(--page-gap)">
					<Button
						type="submit"
						size="default"
						icon={Save}
						disabled={saveDisabled}
					>
						Save
					</Button>
					{restart}
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
		</section>
	);
}
