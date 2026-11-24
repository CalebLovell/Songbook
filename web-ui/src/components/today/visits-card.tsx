import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Count } from "~/components/ui/count.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { formatClockRange, formatTimeAgo } from "~/lib/time-ago.ts";
import type { DayVisit } from "~/lib/today.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";

const TITLE = "Visit log";
const CARD_CLASS = "@container flex flex-col";
const LISTED_CARD_CLASS = `${CARD_CLASS} max-h-[clamp(20rem,60vh,36rem)] min-[1800px]:max-h-none min-h-0 min-[1800px]:flex-1 pb-0`;
const ROW_CLASS = "flex items-center @min-[26rem]:gap-3 gap-2 px-page py-1.75";
const LIST_CLASS = "-mx-page min-h-0 flex-1 divide-y";
const SKELETON_ROWS = 12;
const TIME_COLUMN_CLASS = "@min-[26rem]:block hidden shrink-0 text-right";
const ROW_BUTTON = {
	size: "sm" as const,
	labelClassName: "@min-[26rem]:inline hidden",
	className: "@min-[26rem]:w-auto w-7 @min-[26rem]:px-3 px-0",
};

type VisitOrder = "newest" | "oldest";

const ORDER_META: Record<VisitOrder, { label: string; icon: LucideIcon }> = {
	newest: { label: "Newest", icon: ArrowDown },
	oldest: { label: "Oldest", icon: ArrowUp },
};

function VisitOrderButton({
	order,
	onOrderChange,
}: {
	order: VisitOrder;
	onOrderChange?: (next: VisitOrder) => void;
}) {
	const { label, icon } = ORDER_META[order];
	return (
		<Button
			variant="ghost"
			size="sm"
			icon={icon}
			iconPosition="end"
			aria-label={`Visit order: ${label}`}
			className="-me-1.75 pointer-coarse:-me-2.75 pointer-coarse:h-9 pointer-coarse:px-2.75 px-1.75 text-muted-foreground"
			onClick={() => onOrderChange?.(order === "newest" ? "oldest" : "newest")}
		>
			{label}
		</Button>
	);
}

export function VisitsCardSkeleton() {
	const canListen = useCanListen();
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label={TITLE}
			className={LISTED_CARD_CLASS}
		>
			<CardHeader title={TITLE}>
				<ShellSized className="rounded-md">
					<VisitOrderButton order="newest" />
				</ShellSized>
			</CardHeader>
			<ul aria-hidden="true" className={`${LIST_CLASS} overflow-hidden`}>
				{Array.from({ length: SKELETON_ROWS }, (_, index) => (
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
		</Card>
	);
}

const NAME_WIDTHS = ["w-36", "w-28", "w-44", "w-32", "w-40"];

export function VisitsCard({
	visits,
	generatedAt,
	freshKeys,
}: {
	visits: DayVisit[];
	generatedAt: string;
	freshKeys: Set<string>;
}) {
	const canListen = useCanListen();
	const offsetMs = useAgeOffset(generatedAt);
	const [order, setOrder] = useState<VisitOrder>("newest");
	const listRef = useRef<HTMLUListElement>(null);
	const orderedVisits = order === "newest" ? visits : [...visits].reverse();

	return (
		<Card
			as="section"
			aria-label={TITLE}
			className={visits.length > 0 ? LISTED_CARD_CLASS : CARD_CLASS}
		>
			<CardHeader title={TITLE}>
				{visits.length > 0 ? (
					<VisitOrderButton
						order={order}
						onOrderChange={(next) => {
							setOrder(next);
							listRef.current?.scrollTo({ top: 0 });
						}}
					/>
				) : null}
			</CardHeader>

			{visits.length === 0 ? (
				<EmptyNote>{EMPTY.window.today}</EmptyNote>
			) : (
				<ul ref={listRef} className={`${LIST_CLASS} overflow-y-auto`}>
					{orderedVisits.map((visit) => {
						const clock = formatClockRange(visit.firstAt, visit.lastAt);
						const age = formatTimeAgo(visit.ageMs + offsetMs);

						return (
							<li
								key={visit.key}
								className={`${ROW_CLASS} ${freshKeys.has(visit.latestKey) ? "animate-flash-in" : ""}`}
							>
								<Link
									to="/birds/$comName"
									preload={false}
									params={{ comName: visit.speciesSlug }}
									tabIndex={-1}
									aria-hidden="true"
									className="shrink-0"
								>
									<SpeciesThumbnail
										imageUrl={visit.imageUrl}
										comName={visit.comName}
									/>
								</Link>

								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-baseline gap-1.5">
										<Link
											to="/birds/$comName"
											preload={false}
											params={{ comName: visit.speciesSlug }}
											className="block min-w-0 max-w-fit truncate font-medium no-underline hover:underline"
										>
											{visit.comName}
										</Link>
										{visit.detections > 1 ? (
											<Count
												className="shrink-0"
												title={`${visit.detections.toLocaleString()} detections in this visit`}
											>
												×{visit.detections.toLocaleString()}
											</Count>
										) : null}
									</div>
									<div className="@min-[26rem]:block hidden truncate text-bark text-xs italic">
										{visit.sciName}
									</div>
									<div className="@min-[26rem]:hidden truncate text-muted-foreground text-xs tabular-nums">
										{age} · {clock}
									</div>
								</div>

								<div className={TIME_COLUMN_CLASS}>
									<div className="text-sm tabular-nums">{age}</div>
									<time
										dateTime={visit.lastAt.replace(" ", "T")}
										className="block text-muted-foreground text-xs tabular-nums"
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
		</Card>
	);
}
