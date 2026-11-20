import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
	BirdProfileCard,
	BirdProfileCardShell,
	PROFILE_TEXT_CLASS,
	ProfileCardFrame,
	ProfileTextShell,
} from "~/components/bird-profile-card.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { ShellSized } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import type { CurrentBird } from "~/lib/today.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";
import { cn } from "~/lib/utils.ts";

const LABEL = "Now hearing";

function ListenShell() {
	const canListen = useCanListen();
	return (
		<div className="flex min-h-7 flex-wrap items-center gap-2">
			<ShellSized className="rounded-full">
				<ConfidencePill confidence={0.9} />
			</ShellSized>
			{canListen ? (
				<ShellSized className="rounded-md">
					<RecordingButton audioUrl={null} size="sm" />
				</ShellSized>
			) : null}
		</div>
	);
}

export function TodayHeaderShell() {
	return <BirdProfileCardShell label={LABEL} actions={<ListenShell />} />;
}

export function TodayHeader({
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
			<ProfileCardFrame label={LABEL} portrait={<NestPortrait />}>
				<StandIn>
					<h1 className="font-bold text-2xl sm:text-3xl">
						{hasAnyDetections
							? EMPTY.window.liveQuietTitle
							: EMPTY.station.liveHeroTitle}
					</h1>
					<p className="text-muted-foreground">
						{hasAnyDetections
							? EMPTY.window.liveQuietBody
							: EMPTY.station.liveHeroBody}
					</p>
				</StandIn>
			</ProfileCardFrame>
		);
	}

	return (
		<BirdProfileCard
			label={LABEL}
			className={cn(flash && "animate-flash-in")}
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
				<p className="font-semibold text-lg text-moss leading-5">
					{formatTimeAgo(current.ageMs + offsetMs)}
				</p>
			}
			actions={
				<div className="flex min-h-7 flex-wrap items-center gap-2">
					<ConfidencePill confidence={current.confidence} />
					{canListen ? (
						<RecordingButton
							audioUrl={current.audioUrl}
							speciesName={current.comName}
							size="sm"
						/>
					) : null}
				</div>
			}
		/>
	);
}

function StandIn({ children }: { children: ReactNode }) {
	return (
		<div className="grid">
			<div inert className="invisible col-start-1 row-start-1 grid">
				<ProfileTextShell actions={<ListenShell />} />
			</div>
			<div
				className={`col-start-1 row-start-1 ${PROFILE_TEXT_CLASS} sm:justify-center`}
			>
				{children}
			</div>
		</div>
	);
}

function NestPortrait() {
	return (
		<img
			src="/illustrations/nest.webp"
			alt="An empty nest"
			className="max-h-full max-w-full object-contain"
		/>
	);
}
