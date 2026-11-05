import { CardHeader } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import {
	ClipMeta,
	ClipMetaSkeleton,
	SpectrogramPlayer,
	SpectrogramPlayerSkeleton,
} from "~/components/spectrogram-player.tsx";
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
		<section
			aria-label="Best recording"
			className={`feature-card flex flex-col rounded-md p-4 ${className}`}
		>
			<CardHeader title="Best recording" />

			{!recording || !recording.audioUrl ? (
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
		</section>
	);
}

export function BestRecordingCardSkeleton({
	className = "",
}: {
	className?: string;
}) {
	return (
		<section
			aria-busy="true"
			aria-label="Best recording"
			className={`feature-card flex flex-col rounded-md p-4 ${className}`}
		>
			<CardHeader title="Best recording" />
			<div className="mt-page flex flex-1 flex-col">
				<SpectrogramPlayerSkeleton
					fill
					className={PLOT_CLASS}
					aside={<ClipMetaSkeleton />}
				/>
			</div>
		</section>
	);
}
