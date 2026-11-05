import type { ReactNode } from "react";
import { LivePillSkeleton } from "~/components/now/live-pill.tsx";
import {
	HERO_ACTIONS_CLASS,
	HERO_CARD_SHELL,
	HERO_PORTRAIT_SLOT,
	HeroCardShell,
	HeroTextShell,
	SpeciesHeroCard,
} from "~/components/species-hero-card.tsx";
import { formatDateTime } from "~/lib/date-format.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { CurrentBird } from "~/lib/now.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";

export function CurrentBirdCard({
	current,
	hasAnyDetections,
	generatedAt,
	flash,
	pill,
}: {
	current: CurrentBird | null;
	hasAnyDetections: boolean;
	generatedAt: string;
	flash: boolean;
	pill: ReactNode;
}) {
	const live = pill;
	const offsetMs = useAgeOffset(generatedAt);

	if (!current && hasAnyDetections) {
		return (
			<HeroCardShell
				label="Last 24 hours"
				portrait={<NestPortrait />}
				actions={live}
			>
				<StandInBody live={live}>
					<h1 className="font-bold text-2xl sm:text-3xl">
						{EMPTY.window.liveQuietTitle}
					</h1>
					<p className="text-muted-foreground">{EMPTY.window.liveQuietBody}</p>
				</StandInBody>
			</HeroCardShell>
		);
	}

	if (!current) {
		return (
			<HeroCardShell label="Station status" portrait={<NestPortrait />}>
				<StandInBody>
					<h1 className="font-bold text-2xl sm:text-3xl">
						{EMPTY.station.liveHeroTitle}
					</h1>
					<p className="text-muted-foreground">{EMPTY.station.liveHeroBody}</p>
				</StandInBody>
			</HeroCardShell>
		);
	}

	const elapsedMs = current.ageMs + offsetMs;

	return (
		<SpeciesHeroCard
			label="Last 24 hours"
			comName={current.comName}
			sciName={current.sciName}
			speciesSlug={current.speciesSlug}
			imageUrl={current.imageUrl}
			relativeTime={formatTimeAgo(elapsedMs)}
			heardAt={formatDateTime(current.detectedAt)}
			confidence={current.confidence}
			audioUrl={current.audioUrl}
			actions={live}
			className={flash ? `${HERO_CARD_SHELL} flash-in` : HERO_CARD_SHELL}
		/>
	);
}

function StandInBody({
	live,
	children,
}: {
	live?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="grid">
			<div
				aria-hidden="true"
				inert
				className="invisible col-start-1 row-start-1 flex flex-col gap-2.5 max-[400px]:gap-2"
			>
				<HeroTextShell actions={<LivePillSkeleton />} />
			</div>
			<div className="col-start-1 row-start-1 flex items-start justify-between gap-3 max-[400px]:gap-2">
				<div className="flex min-w-0 flex-col justify-center gap-2 self-stretch">
					{children}
				</div>
				{live ? <div className={HERO_ACTIONS_CLASS}>{live}</div> : null}
			</div>
		</div>
	);
}

function NestPortrait() {
	return (
		<div className={`${HERO_PORTRAIT_SLOT} overflow-hidden`}>
			<img
				src="/illustrations/nest.webp"
				alt="An empty nest"
				className="max-h-full max-w-full object-contain"
			/>
		</div>
	);
}
