import { AlertTriangle } from "lucide-react";
import { SIGN_IN_CARD_TITLE } from "~/components/auth/unlock-gate.tsx";
import { CardHeader } from "~/components/card-header.tsx";
import { Card } from "~/components/ui/card.tsx";
import { UNLOCK_MESSAGES } from "~/lib/unlock-messages.ts";

export function StationNotReadyCard({
	state,
}: {
	state: "not-set-up" | "misconfigured";
}) {
	return (
		<Card
			as="section"
			aria-labelledby="station-not-ready"
			className="flex flex-col gap-page"
		>
			<CardHeader
				as="h2"
				titleId="station-not-ready"
				title={SIGN_IN_CARD_TITLE}
			/>
			<p role="status" className="m-0 flex items-start gap-2 text-bark text-sm">
				<AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
				<span>{UNLOCK_MESSAGES[state]}</span>
			</p>
		</Card>
	);
}
