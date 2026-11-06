import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	ArrowDownAZ,
	ArrowDownWideNarrow,
	ArrowUpNarrowWide,
	BarChart3,
	ChevronDown,
	Clock,
	ExternalLink,
	Feather,
	Volume2,
} from "lucide-react";
import { useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";
import { CardHeader } from "~/components/card-header.tsx";
import { Deferred } from "~/components/deferred.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import {
	SPECIES_ACTION_BUTTON,
	SpeciesActions,
} from "~/components/species-actions.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Count } from "~/components/ui/count.tsx";
import {
	PAGE_RANGE_CARD_CLASS,
	PAGE_RANGE_CLASS,
	PageRange,
	PageStepper,
} from "~/components/ui/page-stepper.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { SearchInput } from "~/components/ui/search-input.tsx";
import {
	ShellBar,
	ShellFigure,
	ShellSized,
	ShellText,
} from "~/components/ui/shell.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { formatDateTime } from "~/lib/date-format.ts";
import { getLifeListCards, type LifeListCard } from "~/lib/detections.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { speciesFuse } from "~/lib/species-fuse.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { useDraft } from "~/lib/use-draft.ts";
import { useSettled } from "~/lib/use-settled.ts";
import { cn } from "~/lib/utils.ts";

const SORT_KEYS = ["count", "recent", "alpha"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_SEARCH = {
	q: "",
	sort: "count" as SortKey,
	reverse: false,
	page: 1,
};

const speciesSearchSchema = z.object({
	q: z.coerce.string().default(DEFAULT_SEARCH.q).catch(DEFAULT_SEARCH.q),
	sort: z
		.enum(SORT_KEYS)
		.default(DEFAULT_SEARCH.sort)
		.catch(DEFAULT_SEARCH.sort),
	reverse: z
		.boolean()
		.default(DEFAULT_SEARCH.reverse)
		.catch(DEFAULT_SEARCH.reverse),
	page: z
		.number()
		.int()
		.min(1)
		.default(DEFAULT_SEARCH.page)
		.catch(DEFAULT_SEARCH.page),
});

export const Route = createFileRoute("/birds/")({
	head: () => ({ meta: [{ title: pageTitle("All Birds") }] }),
	validateSearch: speciesSearchSchema,
	search: {
		middlewares: [stripSearchParams(DEFAULT_SEARCH)],
	},
	component: Species,
	loader: () => ({ cards: getLifeListCards() }),
});

const PAGE_SIZE = 24;

const GRID_CLASS =
	"grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-page";
const CARD_CLASS =
	"relative flex flex-col gap-3 overflow-hidden max-[400px]:gap-2";
const FOOTER_CLASS = "mt-auto flex flex-wrap items-center gap-page text-sm";

function Species() {
	const { cards } = Route.useLoaderData();

	return (
		<PageWrap className="flex min-h-full flex-col gap-page">
			<PageHeaderCard
				icon={Feather}
				title={PAGE_HEADERS.birds.title}
				description={<LifeListSummary cards={cards} />}
			/>

			<SpeciesControls />

			<Deferred promise={cards} shell={<SpeciesGridShell />}>
				{(loaded) => <SpeciesBrowser cards={loaded} />}
			</Deferred>
		</PageWrap>
	);
}

function LifeListSummary({ cards }: { cards: Promise<LifeListCard[]> }) {
	const settled = useSettled(cards);
	const loaded = settled?.value ?? null;
	const detections = loaded?.reduce((sum, card) => sum + card.allTimeCount, 0);
	return PAGE_HEADERS.birds.description(
		detections === undefined ? (
			<ShellFigure />
		) : (
			<Count>{detections.toLocaleString()}</Count>
		),
		loaded ? <Count>{loaded.length.toLocaleString()}</Count> : <ShellFigure />,
		detections === 1,
	);
}

function SpeciesControls() {
	const { q: search, sort, reverse } = Route.useSearch();
	const navigate = Route.useNavigate();

	const [queryInput, setQueryInput] = useDraft(search);

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		navigate({
			search: (prev) => ({ ...prev, q: value, page: 1 }),
			replace: true,
		});
	}, 200);

	const pickSort = (next: SortKey) =>
		navigate({
			search: (prev) => ({ ...prev, sort: next, reverse: false, page: 1 }),
			replace: true,
		});
	const flipDirection = () =>
		navigate({
			search: (prev) => ({ ...prev, reverse: !prev.reverse, page: 1 }),
			replace: true,
		});

	return (
		<div className="flex items-center gap-page">
			<SearchInput
				aria-label="Filter birds"
				placeholder="Search birds..."
				value={queryInput}
				onChange={(e) => {
					const value = e.target.value;
					setQueryInput(value);
					debouncedSetQuery(value);
				}}
				onClear={() => {
					setQueryInput("");
					debouncedSetQuery.cancel();
					navigate({
						search: (prev) => ({ ...prev, q: "", page: 1 }),
						replace: true,
					});
				}}
			/>
			<SortSelect
				sort={sort}
				reverse={reverse}
				onSort={pickSort}
				onReverse={flipDirection}
			/>
			<SortTabs
				sort={sort}
				reverse={reverse}
				onSort={pickSort}
				onReverse={flipDirection}
			/>
		</div>
	);
}

function SpeciesGridShell() {
	return (
		<div aria-busy="true" className="flex flex-1 flex-col gap-page">
			<div className={GRID_CLASS}>
				{Array.from({ length: PAGE_SIZE }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					<SpeciesCardSkeleton key={index} index={index} />
				))}
			</div>
			<div aria-hidden="true" className={FOOTER_CLASS}>
				<div className={`${PAGE_RANGE_CLASS} ${PAGE_RANGE_CARD_CLASS}`}>
					<ShellText
						className="w-40 text-sm max-[400px]:w-20"
						barClassName="w-full"
					/>
				</div>
				<span className="ml-auto">
					<ShellSized className="rounded-md">
						<PageStepper
							label="Bird pages"
							page={1}
							pageCount={2}
							onPageChange={() => {}}
						/>
					</ShellSized>
				</span>
			</div>
		</div>
	);
}

const CARD_NOTE_CLASS = "text-[11px] text-muted-foreground leading-none";

const NAME_WIDTHS = ["w-36", "w-28", "w-40", "w-32"];

function SpeciesCardSkeleton({ index }: { index: number }) {
	return (
		<Card aria-hidden="true" className={CARD_CLASS}>
			<div className="flex flex-col gap-1">
				<div className="flex items-baseline gap-1">
					<ShellText
						className="w-14 font-semibold text-lg leading-none"
						barClassName="w-full"
					/>
					<ShellText
						className={`w-12 ${CARD_NOTE_CLASS}`}
						barClassName="w-full"
					/>
				</div>
			</div>
			<div className="relative min-h-40 w-full flex-1">
				<ShellBar className="absolute inset-0 rounded-md" />
			</div>
			<div className="flex flex-col gap-3 max-[400px]:gap-2">
				<div>
					<ShellText
						className="font-bold text-base"
						barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
					/>
					<ShellText className="text-xs" barClassName="w-28" />
				</div>
				<div className="flex w-full flex-wrap items-center gap-2">
					<ShellSized className="rounded-md">
						<Button {...SPECIES_ACTION_BUTTON} icon={Volume2}>
							Listen
						</Button>
					</ShellSized>
					<ShellSized className="rounded-md">
						<Button
							variant="outline"
							{...SPECIES_ACTION_BUTTON}
							icon={ExternalLink}
						>
							eBird
						</Button>
					</ShellSized>
				</div>
				<ShellText
					className={`w-full ${CARD_NOTE_CLASS}`}
					barClassName="right-0 left-auto w-36"
				/>
			</div>
		</Card>
	);
}

function SpeciesBrowser({ cards }: { cards: LifeListCard[] }) {
	const { q: search, sort, reverse, page } = Route.useSearch();
	const navigate = Route.useNavigate();

	const fuse = useMemo(() => speciesFuse(cards), [cards]);

	const filtered = useMemo(() => {
		const query = search.trim();
		const matches = query ? fuse.search(query).map((r) => r.item) : cards;

		const direction = reverse ? -1 : 1;
		return [...matches].sort((a, b) => {
			if (sort === "alpha")
				return direction * a.comName.localeCompare(b.comName);
			if (sort === "recent")
				return direction * b.lastDetected.localeCompare(a.lastDetected);
			return direction * (b.allTimeCount - a.allTimeCount);
		});
	}, [cards, fuse, search, sort, reverse]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageItems = filtered.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	return (
		<div className="flex flex-1 flex-col gap-page">
			{pageItems.length === 0 ? (
				<Card as="section" aria-label="Species recorded">
					<CardHeader title="Species recorded" />
					<EmptyNote>
						{cards.length === 0
							? EMPTY.station.species
							: EMPTY.filter.birdsSearch(search)}
					</EmptyNote>
				</Card>
			) : (
				<div className={GRID_CLASS}>
					{pageItems.map((card) => (
						<SpeciesCard key={card.comName} card={card} />
					))}
				</div>
			)}

			{pageItems.length > 0 && (
				<SpeciesFooter
					first={(currentPage - 1) * PAGE_SIZE + 1}
					last={(currentPage - 1) * PAGE_SIZE + pageItems.length}
					total={filtered.length}
					lifeList={cards.length}
					page={currentPage}
					pageCount={pageCount}
					onPageChange={(next) =>
						navigate({
							search: (prev) => ({ ...prev, page: next }),
							replace: true,
						})
					}
				/>
			)}
		</div>
	);
}

const SORT_META: Record<
	SortKey,
	{ label: string; icon: React.ComponentType<{ className?: string }> }
> = {
	count: { label: "Total", icon: BarChart3 },
	recent: { label: "Recent", icon: Clock },
	alpha: { label: "Name", icon: ArrowDownAZ },
};

function SpeciesFooter({
	first,
	last,
	total,
	lifeList,
	page,
	pageCount,
	onPageChange,
}: {
	first: number;
	last: number;
	total: number;
	lifeList: number;
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
}) {
	return (
		<div className={FOOTER_CLASS}>
			<PageRange
				card
				first={first}
				last={last}
				total={{ count: total, noun: ["species", "species"] }}
			>
				{total < lifeList ? (
					<span className="max-sm:hidden">
						{" "}
						&middot; filtered from{" "}
						<span className="tabular-nums">{lifeList.toLocaleString()}</span>
					</span>
				) : null}
			</PageRange>
			<PageStepper
				className="ml-auto"
				label="Bird pages"
				page={page}
				pageCount={pageCount}
				onPageChange={onPageChange}
			/>
		</div>
	);
}

function SortSelect({
	sort,
	reverse,
	onSort,
	onReverse,
}: {
	sort: SortKey;
	reverse: boolean;
	onSort: (next: SortKey) => void;
	onReverse: () => void;
}) {
	const Icon = SORT_META[sort].icon;
	return (
		<div className="flex h-8.5 pointer-coarse:h-9 shrink-0 overflow-hidden rounded-md border border-input bg-card focus-within:border-focus-ring sm:hidden">
			<div className="relative">
				<Icon
					className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 max-[400px]:hidden"
					aria-hidden="true"
				/>
				<select
					aria-label="Sort by"
					value={sort}
					onChange={(event) => onSort(event.target.value as SortKey)}
					className="h-full cursor-pointer appearance-none bg-transparent pr-7 pl-8 font-medium pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none max-[400px]:pl-2.5"
				>
					{SORT_KEYS.map((key) => (
						<option key={key} value={key}>
							{SORT_META[key].label}
						</option>
					))}
				</select>
				<ChevronDown
					className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<DirectionButton
				reverse={reverse}
				onReverse={onReverse}
				className="w-8.5 border-l"
			/>
		</div>
	);
}

function SortTabs({
	sort,
	reverse,
	onSort,
	onReverse,
}: {
	sort: SortKey;
	reverse: boolean;
	onSort: (next: SortKey) => void;
	onReverse: () => void;
}) {
	return (
		<div className="hidden shrink-0 sm:flex">
			<ToggleGroup
				type="single"
				variant="outline"
				value={sort}
				onValueChange={(value) => {
					if (value) onSort(value as SortKey);
				}}
			>
				{SORT_KEYS.map((key) => {
					const Icon = SORT_META[key].icon;
					return (
						<ToggleGroupItem
							key={key}
							value={key}
							className="data-[spacing=0]:last:rounded-r-none"
						>
							<Icon className="size-4" />
							{key === "alpha" ? "Alphabetical" : SORT_META[key].label}
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>
			<DirectionButton
				reverse={reverse}
				onReverse={onReverse}
				className="pointer-coarse:w-9 w-8.5 rounded-r-md border border-l-0"
			/>
		</div>
	);
}

function DirectionButton({
	reverse,
	onReverse,
	className,
}: {
	reverse: boolean;
	onReverse: () => void;
	className: string;
}) {
	const Direction = reverse ? ArrowUpNarrowWide : ArrowDownWideNarrow;
	return (
		<button
			type="button"
			aria-label="Reverse sort order"
			aria-pressed={reverse}
			title={reverse ? "Reversed" : "Reverse order"}
			onClick={onReverse}
			className={cn(
				"flex shrink-0 items-center justify-center border-input bg-card hover:bg-accent hover:text-accent-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground",
				className,
			)}
		>
			<Direction className="size-4" aria-hidden="true" />
		</button>
	);
}

function SpeciesCard({ card }: { card: LifeListCard }) {
	const lastHeard = card.lastDetected ? formatDateTime(card.lastDetected) : "—";

	return (
		<Card
			className={`${CARD_CLASS} hover:transform-[translateY(-2px)] hover:border-hover-line has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2`}
		>
			<Link
				to="/birds/$comName"
				params={{ comName: comNameToSlug(card.comName) }}
				data-card-link=""
				className="absolute inset-0 z-0 focus-visible:outline-none"
				aria-label={`View ${card.comName}`}
			/>
			<div className="flex flex-col gap-1">
				<div className="flex items-baseline gap-1">
					<div className="font-semibold text-foreground text-lg tabular-nums leading-none">
						{card.allTimeCount.toLocaleString()}
					</div>
					<div className={CARD_NOTE_CLASS}>
						{card.allTimeCount === 1 ? "detection" : "detections"}
					</div>
				</div>
			</div>

			<div className="pointer-events-none relative min-h-40 w-full flex-1">
				<div className="absolute inset-0 flex items-center justify-center overflow-hidden">
					<SpeciesImage
						imageUrl={card.imageUrl}
						alt={card.comName}
						glyphClassName="size-16"
						loading="lazy"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-3 max-[400px]:gap-2">
				<div>
					<h2 className="font-bold text-base">{card.comName}</h2>
					<p className="text-bark text-xs italic">{card.sciName}</p>
				</div>
				<SpeciesActions
					audioUrl={card.audioUrl}
					speciesLink={card.speciesLink}
					comName={card.comName}
				/>
				<div className={`w-full self-end text-right ${CARD_NOTE_CLASS}`}>
					Last heard · {lastHeard}
				</div>
			</div>
		</Card>
	);
}
