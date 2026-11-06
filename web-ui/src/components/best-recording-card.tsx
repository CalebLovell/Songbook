import { CardHeader } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import {
	ClipMeta,
	ClipMetaSkeleton,
	SpectrogramPlayer,
	SpectrogramPlayerSkeleton,
} from "~/components/spectrogram-player.tsx";
import { Card } from "~/components/ui/card.tsx";
import { formatDateTime } from "~/lib/date-format.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { BestRecording } from "~/lib/species-detail.ts";

const PLOT_CLASS = "min-h-32 flex-1";

export function BestRecordingCard({
	recording,
	speciesName,
	className = "",
}: {
	recording: BestRecording | null;
	speciesName?: string;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-label="Best recording"
			className={`flex flex-col ${className}`}
		>
			<CardHeader title="Best recording" />

			{!recording?.audioUrl ? (
				<EmptyNote>{EMPTY.window.birdRecording}</EmptyNote>
			) : (
				<div className="mt-page flex flex-1 flex-col">
					<SpectrogramPlayer
						key={recording.audioUrl}
						audioUrl={recording.audioUrl}
						speciesName={speciesName}
						fill
						className={PLOT_CLASS}
						aside={
							<ClipMeta
								heardAt={formatDateTime(recording.date, recording.time)}
								confidence={recording.confidence}
							/>
						}
					/>
				</div>
			)}
		</Card>
	);
}

export function BestRecordingCardSkeleton({
	className = "",
}: {
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label="Best recording"
			className={`flex flex-col ${className}`}
		>
			<CardHeader title="Best recording" />
			<div className="mt-page flex flex-1 flex-col">
				<SpectrogramPlayerSkeleton
					fill
					className={PLOT_CLASS}
					aside={<ClipMetaSkeleton />}
				/>
			</div>
		</Card>
	);
}
