import { Link } from "@tanstack/react-router";
import { CardHeader } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { LIST_ROW, SpeciesThumbnail } from "~/components/species-row.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { rankingBarPercent } from "~/lib/stats-data.ts";

export type SpeciesListItem = {
	comName: string;
	sciName: string;
	count: number;
	imageUrl: string | null;
	speciesSlug?: string;
};

export function SpeciesList({
	title,
	species,
	emptyMessage = EMPTY.station.detections,
	ariaLabel = title,
	className = "",
}: {
	title: string;
	species: SpeciesListItem[];
	emptyMessage?: string;
	ariaLabel?: string;
	className?: string;
}) {
	const maximum = Math.max(...species.map((item) => item.count), 0);

	return (
		<section
			aria-label={ariaLabel}
			className={`feature-card flex flex-col rounded-md p-4 ${className}`}
		>
			<CardHeader title={title} />

			{species.length === 0 ? (
				<EmptyNote>{emptyMessage}</EmptyNote>
			) : (
				<ol className="mt-4 space-y-1">
					{species.map((item) => (
						<SpeciesListRow key={item.comName} item={item} maximum={maximum} />
					))}
				</ol>
			)}
		</section>
	);
}

function SpeciesListRow({
	item,
	maximum,
}: {
	item: SpeciesListItem;
	maximum: number;
}) {
	const { comName, sciName, count, imageUrl } = item;

	return (
		<li className={LIST_ROW}>
			<SpeciesThumbnail imageUrl={imageUrl} comName={comName} />

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline justify-between gap-2">
					<Link
						to="/birds/$comName"
						params={{ comName: item.speciesSlug ?? comNameToSlug(comName) }}
						className="truncate font-medium no-underline hover:underline"
					>
						{comName}
					</Link>
					<span className="count-figure shrink-0">
						{count.toLocaleString()}
					</span>
				</div>
				<div className="truncate text-bark text-xs italic">{sciName}</div>
				<div
					className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-track"
					role="img"
					aria-label={`${count} detections`}
				>
					<div
						className="h-full rounded-full"
						style={{
							width: `${rankingBarPercent(count, maximum)}%`,
							backgroundColor: "var(--moss)",
							opacity: 0.75,
						}}
					/>
				</div>
			</div>
		</li>
	);
}
