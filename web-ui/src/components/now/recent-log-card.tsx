import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { CardHeader } from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { RECENT_LIMIT, type RecentVisit } from "~/lib/now.ts";
import { formatClockRange, formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";
import { VISIT_GAP_MINUTES } from "~/lib/visits.ts";

// Shared with the skeleton below, which is built from the same pieces so the
// card is the same shape loading and loaded.
const CARD_CLASS = "@container feature-card flex flex-col rounded-md p-4";
const ROW_CLASS =
	"flex items-center @min-[26rem]:gap-3 gap-2 px-(--page-gap) py-1.75";
const TIME_COLUMN_CLASS = "@min-[26rem]:block hidden shrink-0 text-right";
const ROW_BUTTON = {
	size: "sm" as const,
	labelClassName: "@min-[26rem]:inline hidden",
	className: "@min-[26rem]:w-auto w-7 @min-[26rem]:px-3 px-0",
};
const FOOTER_CLASS =
	"-mx-(--page-gap) mt-auto -mb-(--page-gap) flex min-h-[45px] shrink-0 items-center justify-end border-t px-(--page-gap)";
const FOOTER_LINK_CLASS =
	"inline-flex items-center gap-1 text-muted-foreground text-xs no-underline hover:text-foreground hover:underline";

/** The visit log's header band: a full-width hairline under a 45px strip,
    the info tip held right. Needs no data, so the skeleton draws it as
    itself. */
function RecentLogHeader() {
	return (
		<CardHeader title="Recent activity">
			<InfoTip label="Recent activity" size="default">
				<p>
					The live activity from your station is updated here in real time, and
					detections are listed from most recent to least recent. Visits are
					combined when the same bird is heard repeatedly without a{" "}
					{VISIT_GAP_MINUTES} minute gap.
				</p>
				<p>
					Each row displays the species, number of detections, when they were
					heard, and the confidence percentile assigned by the BirdNET
					algorithm. The link in the bottom right redirects to the complete
					timeline view for the day.
				</p>
			</InfoTip>
		</CardHeader>
	);
}

/** The visit log's footer: a hairline across the card's full width, the
    card's one link held right. Needs no data either. */
function RecentLogFooter() {
	return (
		<div className={FOOTER_CLASS}>
			{/* The log is a rolling 24 hours; the calendar day, hour by hour, is
			    the Timeline's Daily view, which opens on today. */}
			<Link to="/timeline" className={FOOTER_LINK_CLASS}>
				All of today
				<ArrowRight aria-hidden className="size-3" />
			</Link>
		</div>
	);
}

/**
 * The card before its first snapshot: the header as itself, then a full
 * log's rows built from the real row's pieces -- a thumbnail-sized square, a
 * bar on each of the name's two lines, the time column, and shells the exact
 * size of the pill and the play button -- over the footer as itself.
 */
export function RecentLogCardSkeleton() {
	const canListen = useCanListen();
	return (
		<section
			aria-busy="true"
			aria-label="Recent detections"
			className={CARD_CLASS}
		>
			<RecentLogHeader />
			<ul aria-hidden="true" className="-mx-(--page-gap) divide-y">
				{Array.from({ length: RECENT_LIMIT }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					<li key={index} className={ROW_CLASS}>
						<div className="flex size-10 shrink-0 items-center justify-center">
							<ShellBar className="size-9 rounded-md" />
						</div>
						<div className="min-w-0 flex-1">
							<ShellText
								className="font-medium"
								barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
							/>
							<ShellText className="text-xs" barClassName="w-24" />
						</div>
						<div className={TIME_COLUMN_CLASS}>
							<ShellText
								className="w-20 text-sm"
								barClassName="right-0 left-auto w-16"
							/>
							<ShellText
								className="w-20 text-xs"
								barClassName="right-0 left-auto w-20"
							/>
						</div>
						<ShellSized className="rounded-full">
							<ConfidencePill confidence={0.9} className="shrink-0" />
						</ShellSized>
						{canListen ? (
							<ShellSized className="rounded-md">
								<RecordingButton audioUrl={null} {...ROW_BUTTON} />
							</ShellSized>
						) : null}
					</li>
				))}
			</ul>
			<RecentLogFooter />
		</section>
	);
}

/** Names come in all lengths; so do their bars. */
const NAME_WIDTHS = ["w-36", "w-28", "w-44", "w-32", "w-40"];

/**
 * The window's newest visits, most recently heard first, set like the bird
 * page's visit log: a header band, hairline-divided rows bled to the card's
 * edges, a footer that links on to today's Timeline, and a layout that answers to
 * the card's own width rather than the screen's -- the card spans the page on
 * a phone and takes the wider track beside the rail at lg.
 *
 * A row is a visit, not a detection: BirdNET-Pi writes one row per 3-second
 * window, so a singing robin would otherwise bury everything else under forty
 * copies of itself. The row says how many detections it folds up and the span
 * they cover, and plays the most confident one.
 *
 * It shows the newest RECENT_LIMIT visits and no more: the page is a glance
 * at what's been around, so rather than paging through the window, the
 * footer hands the rest of the day to the Timeline.
 */
export function RecentLogCard({
	recent,
	generatedAt,
	freshKeys,
}: {
	/** The newest visits, from the polled snapshot. */
	recent: RecentVisit[];
	/** When the snapshot was built, which the ages are measured from. */
	generatedAt: string;
	freshKeys: Set<string>;
}) {
	const canListen = useCanListen();
	const offsetMs = useAgeOffset(generatedAt);

	return (
		<section aria-label="Recent detections" className={CARD_CLASS}>
			<RecentLogHeader />

			{recent.length === 0 ? (
				<EmptyNote>{EMPTY.window.last24Hours}</EmptyNote>
			) : (
				<ul className="-mx-(--page-gap) divide-y">
					{recent.map((visit) => {
						const clock = formatClockRange(visit.firstAt, visit.lastAt);
						const age = formatTimeAgo(visit.ageMs + offsetMs);

						return (
							<li
								key={visit.key}
								// Under 26rem the row can't hold the names, a time column,
								// the pill and a labelled button side by side, so the age
								// and time take the binomial's line and the button drops its
								// label. Two lines either way, so the row keeps its height.
								//
								// The dividers run out to the card's edges and the row's own
								// padding hands the page gap back, so the content lines up
								// with the header's.
								className={`${ROW_CLASS} ${freshKeys.has(visit.key) ? "flash-in" : ""}`}
							>
								<SpeciesThumbnail
									imageUrl={visit.imageUrl}
									comName={visit.comName}
								/>

								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-baseline gap-1.5">
										<Link
											to="/birds/$comName"
											params={{ comName: visit.speciesSlug }}
											className="block min-w-0 max-w-fit truncate font-medium no-underline hover:underline"
										>
											{visit.comName}
										</Link>
										{visit.detections > 1 ? (
											<span
												className="count-figure shrink-0"
												title={`${visit.detections.toLocaleString()} detections in this visit`}
											>
												×{visit.detections.toLocaleString()}
											</span>
										) : null}
									</div>
									<div className="@min-[26rem]:block hidden truncate text-[var(--bark)] text-xs italic">
										{visit.sciName}
									</div>
									<div className="tabular-data @min-[26rem]:hidden truncate text-muted-foreground text-xs">
										{age} · {clock}
									</div>
								</div>

								<div className={TIME_COLUMN_CLASS}>
									<div className="tabular-data text-sm">{age}</div>
									<time
										dateTime={visit.lastAt.replace(" ", "T")}
										className="tabular-data block text-muted-foreground text-xs"
									>
										{clock}
									</time>
								</div>

								<ConfidencePill
									confidence={visit.confidence}
									className="shrink-0"
								/>
								{canListen ? (
									<RecordingButton
										audioUrl={visit.audioUrl}
										speciesName={visit.comName}
										{...ROW_BUTTON}
									/>
								) : null}
							</li>
						);
					})}
				</ul>
			)}

			<RecentLogFooter />
		</section>
	);
}
