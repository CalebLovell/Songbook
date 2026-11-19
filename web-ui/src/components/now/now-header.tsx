import { Link } from "@tanstack/react-router";

import {
	BirdProfileCard,
	BirdProfileCardShell,
} from "~/components/bird-profile-card.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { ShellText } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { CurrentBird } from "~/lib/now.ts";
import { formatClockTime, formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";

const LABEL = "Now hearing";

export function NowHeaderShell() {
	return (
		<BirdProfileCardShell
			label={LABEL}
			actions={<ShellText className="text-sm" barClassName="w-28" />}
		/>
	);
}

export function NowHeader({
	current,
	hasAnyDetections,
	generatedAt,
	flash,
}: {
	current: CurrentBird | null;
	hasAnyDetections: boolean;
	generatedAt: string;
	flash: boolean;
}) {
	const offsetMs = useAgeOffset(generatedAt);
	const canListen = useCanListen();

	if (!current) {
		return (
			<BirdProfileCard
				label={LABEL}
				imageUrl="/illustrations/nest.webp"
				comName={
					hasAnyDetections
						? EMPTY.window.liveQuietTitle
						: EMPTY.station.liveHeroTitle
				}
				sciName={null}
				line={
					<p>
						{hasAnyDetections
							? EMPTY.window.liveQuietBody
							: EMPTY.station.liveHeroBody}
					</p>
				}
				actions={null}
			/>
		);
	}

	return (
		<BirdProfileCard
			label={LABEL}
			className={flash ? "animate-flash-in" : undefined}
			imageUrl={current.imageUrl}
			comName={current.comName}
			name={
				<Link
					to="/birds/$comName"
					params={{ comName: current.speciesSlug }}
					className="no-underline hover:underline"
				>
					{current.comName}
				</Link>
			}
			sciName={current.sciName}
			line={
				<p>
					Heard{" "}
					<span className="font-semibold text-foreground">
						{formatTimeAgo(current.ageMs + offsetMs)}
					</span>{" "}
					at{" "}
					<span className="font-semibold text-foreground">
						{formatClockTime(current.detectedAt)}
					</span>
				</p>
			}
			actions={
				<div className="flex flex-wrap items-center gap-2">
					{canListen ? (
						<RecordingButton
							audioUrl={current.audioUrl}
							speciesName={current.comName}
							size="sm"
						/>
					) : null}
					<ConfidencePill confidence={current.confidence} />
				</div>
			}
		/>
	);
}
