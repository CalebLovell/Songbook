import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	CARD_HEADER_CLASS,
	CARD_HEADER_TEXT_BUTTON_CLASS,
} from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import {
	ArtworkPreferenceContext,
	SpeciesImage,
} from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ShellSized } from "~/components/ui/shell.tsx";
import {
	type CollageSource,
	collageBirdsFrom,
	collagePhotosFrom,
	randomMixSeed,
	type ShownCollageBird,
	showCollageBirds,
} from "~/lib/collage-birds.ts";
import {
	type CollageLayout,
	type CollageMask,
	type CollagePlacement,
	layoutCollage,
	ownerAt,
} from "~/lib/collage-layout.ts";
import { maskFor } from "~/lib/collage-masks.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { plural } from "~/lib/number-format.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { cn } from "~/lib/utils.ts";

const COLLAGE_CARD_CLASS = "flex flex-col";
const COLLAGE_FILLED_CLASS =
	"h-[clamp(28rem,70vh,48rem)] xl:h-[calc(100dvh_-_var(--masthead-h)_-_2.125rem_-_4*var(--page-gap))] xl:min-h-[28rem]";
const COLLAGE_AREA_CLASS = "relative mt-page flex-1";
const RESIZE_SETTLE_MS = 150;
const POP_SPREAD_MS = 1200;

const DEFAULT_TITLE = "Activity";

function CollageHeader({
	title,
	summary,
	action,
}: {
	title: string;
	summary?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div data-slot="card-header" className={`${CARD_HEADER_CLASS} gap-3 py-2`}>
			<div className="flex h-[1.035rem] min-w-0 items-center gap-3">
				<Kicker as="h2" className="shrink-0">
					{title}
				</Kicker>
				{summary}
			</div>
			{action}
		</div>
	);
}

function ReshuffleButton({ onClick }: { onClick?: () => void }) {
	return (
		<button
			type="button"
			className={CARD_HEADER_TEXT_BUTTON_CLASS}
			onClick={onClick}
		>
			Reshuffle
		</button>
	);
}

export function CollageCardSkeleton({
	title = DEFAULT_TITLE,
	summary,
	trailing,
	reshuffle = true,
	className = "",
}: {
	title?: string;
	summary?: ReactNode;
	trailing?: ReactNode;
	reshuffle?: boolean;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label={title}
			className={cn(COLLAGE_CARD_CLASS, COLLAGE_FILLED_CLASS, className)}
		>
			<CollageHeader
				title={title}
				summary={summary}
				action={
					trailing ??
					(reshuffle ? (
						<ShellSized className="rounded-sm">
							<ReshuffleButton />
						</ShellSized>
					) : null)
				}
			/>
			<div data-entrance="own" className={COLLAGE_AREA_CLASS} />
		</Card>
	);
}

export function CollageCard({
	species,
	emptyMessage,
	emptyAction,
	title = DEFAULT_TITLE,
	summary,
	trailing,
	reshuffle = true,
	className = "",
}: {
	species: readonly CollageSource[];
	emptyMessage: string;
	emptyAction?: ReactNode;
	title?: string;
	summary?: ReactNode;
	trailing?: ReactNode;
	reshuffle?: boolean;
	className?: string;
}) {
	const photos = useContext(ArtworkPreferenceContext) === "photos";
	const painted = useMemo(
		() => (photos ? [] : collageBirdsFrom(species)),
		[photos, species],
	);
	const [mixSeed, setMixSeed] = useState(randomMixSeed);
	const birds = useMemo(
		() =>
			photos ? collagePhotosFrom(species) : showCollageBirds(painted, mixSeed),
		[photos, species, painted, mixSeed],
	);

	return (
		<Card
			as="section"
			aria-label={title}
			className={cn(
				COLLAGE_CARD_CLASS,
				birds.length > 0 && COLLAGE_FILLED_CLASS,
				className,
			)}
		>
			<CollageHeader
				title={title}
				summary={summary}
				action={
					trailing ??
					(reshuffle && birds.length > 0 && !photos ? (
						<ReshuffleButton onClick={() => setMixSeed(randomMixSeed())} />
					) : null)
				}
			/>
			{species.length === 0 ? (
				<>
					<EmptyNote>{emptyMessage}</EmptyNote>
					{emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
				</>
			) : birds.length === 0 ? (
				<EmptyNote>{EMPTY.window.collageUnpainted}</EmptyNote>
			) : (
				<CollageArea key={mixSeed} birds={birds} />
			)}
		</Card>
	);
}

function CollageArea({ birds }: { birds: ShownCollageBird[] }) {
	const areaRef = useRef<HTMLDivElement>(null);
	const size = useElementSize(areaRef);
	const masks = useMasks(birds);
	const navigate = useNavigate();
	const [hoveredIndex, setHoveredIndex] = useState(-1);
	const [tapped, setTapped] = useState(false);
	const lastPointerType = useRef("mouse");

	const layout = useMemo<CollageLayout | null>(() => {
		if (!masks || !size) return null;
		return layoutCollage(
			birds.map((bird, index) => ({
				key: bird.comName,
				count: bird.count,
				mask: masks[index],
			})),
			size.width,
			size.height,
		);
	}, [birds, masks, size]);

	const hover = (index: number) => {
		setTapped(false);
		if (index === hoveredIndex) return;
		setHoveredIndex(index);
	};

	const openBird = (bird: ShownCollageBird) =>
		navigate({
			to: "/birds/$comName",
			params: { comName: comNameToSlug(bird.comName) },
		});

	useEffect(() => {
		if (!tapped) return;
		const dismissOutside = (event: PointerEvent) => {
			if (areaRef.current?.contains(event.target as Node)) return;
			setTapped(false);
			setHoveredIndex(-1);
		};
		document.addEventListener("pointerdown", dismissOutside);
		return () => document.removeEventListener("pointerdown", dismissOutside);
	}, [tapped]);

	const indexAt = (event: React.PointerEvent | React.MouseEvent) => {
		const area = areaRef.current;
		if (!area || !layout) return -1;
		const box = area.getBoundingClientRect();
		return ownerAt(layout, event.clientX - box.left, event.clientY - box.top);
	};

	const byKey = new Map(birds.map((bird, index) => [bird.comName, index]));
	const popRolls = useRef(new Map<string, number>());
	const popDelays = useMemo(
		() => randomPopDelays(layout?.placements ?? [], popRolls.current),
		[layout],
	);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: each bird is also a focusable link; the area only hit-tests silhouettes for the pointer
		// biome-ignore lint/a11y/noStaticElementInteractions: as above
		<div
			ref={areaRef}
			data-entrance="own"
			className={cn(COLLAGE_AREA_CLASS, hoveredIndex >= 0 && "cursor-pointer")}
			onPointerDown={(event) => {
				lastPointerType.current = event.pointerType;
			}}
			onPointerMove={(event) => {
				if (event.pointerType === "mouse") hover(indexAt(event));
			}}
			onPointerLeave={(event) => {
				if (event.pointerType === "mouse") hover(-1);
			}}
			onClick={(event) => {
				const index = indexAt(event);
				const bird = birds[index];
				if (lastPointerType.current === "mouse") {
					if (bird) openBird(bird);
					return;
				}
				if (bird && tapped && index === hoveredIndex) {
					openBird(bird);
					return;
				}
				setHoveredIndex(index);
				setTapped(index >= 0);
			}}
		>
			{layout ? (
				<ul aria-label="Birds" className="absolute inset-0">
					{layout.placements.map((placement) => {
						const index = byKey.get(placement.key) ?? -1;
						const bird = birds[index];
						if (!bird) return null;
						const lifted = hoveredIndex === index;
						return (
							<li
								key={placement.key}
								className={cn(
									"absolute animate-collage-pop motion-reduce:animate-none",
									lifted && "z-10",
								)}
								style={{
									animationDelay: `${popDelays.get(placement.key) ?? 0}ms`,
									left: placement.x,
									top: placement.y,
									width: placement.width,
									height: placement.height,
								}}
							>
								<Link
									to="/birds/$comName"
									params={{ comName: comNameToSlug(bird.comName) }}
									preload={false}
									aria-label={`${bird.comName}, ${bird.count.toLocaleString()} ${plural(bird.count, "detection")}`}
									onFocus={() => hover(index)}
									onBlur={() => hover(-1)}
									className={cn(
										"pointer-events-none block size-full rounded-md transition-transform duration-180 ease-[ease] motion-reduce:transition-none",
										lifted && "scale-103",
									)}
								>
									{bird.kind === "painting" ? (
										<svg
											viewBox={bird.bounds.join(" ")}
											aria-hidden="true"
											className="size-full"
										>
											<image href={bird.imageUrl} width={480} height={480} />
										</svg>
									) : (
										<span
											aria-hidden="true"
											className="flex size-full items-center justify-center"
										>
											<SpeciesImage
												imageUrl={bird.imageUrl}
												alt=""
												glyphClassName="size-1/2"
											/>
										</span>
									)}
								</Link>
							</li>
						);
					})}
				</ul>
			) : null}
			{layout && size ? (
				<HoverPopup
					bird={birds[hoveredIndex]}
					placement={layout.placements.find(
						(placement) => placement.key === birds[hoveredIndex]?.comName,
					)}
					areaWidth={size.width}
					tapped={tapped}
				/>
			) : null}
			{layout ? null : <div aria-busy="true" className="absolute inset-0" />}
		</div>
	);
}

function randomPopDelays(
	placements: readonly CollagePlacement[],
	rolls: Map<string, number>,
): Map<string, number> {
	const rollFor = (key: string) => {
		const roll = rolls.get(key) ?? Math.random();
		rolls.set(key, roll);
		return roll;
	};
	const sequence = [...placements].sort(
		(a, b) => rollFor(a.key) - rollFor(b.key),
	);
	const last = Math.max(1, sequence.length - 1);
	return new Map(
		sequence.map((placement, rank) => [
			placement.key,
			Math.round((rank / last) * POP_SPREAD_MS),
		]),
	);
}

const POPUP_GAP = 6;
const POPUP_EDGE = 8;

function HoverPopup({
	bird,
	placement,
	areaWidth,
	tapped,
}: {
	bird: ShownCollageBird | undefined;
	placement: CollagePlacement | undefined;
	areaWidth: number;
	tapped: boolean;
}) {
	const [popupWidth, setPopupWidth] = useState(0);

	if (!bird || !placement) return null;
	const centre = placement.x + placement.width / 2;
	const half = popupWidth / 2;
	const left = Math.min(
		Math.max(centre, POPUP_EDGE + half),
		areaWidth - POPUP_EDGE - half,
	);
	const below = placement.y < 40;

	return (
		<div
			ref={(node) => {
				if (node) setPopupWidth(node.offsetWidth);
			}}
			aria-hidden="true"
			className={cn(
				"absolute z-20 whitespace-nowrap rounded-sm border border-line bg-paper-raised text-[13px] text-ink shadow-md",
				tapped ? "pointer-events-auto" : "pointer-events-none px-2 py-1",
			)}
			style={{
				left,
				top: below
					? placement.y + placement.height + POPUP_GAP
					: placement.y - POPUP_GAP,
				transform: below ? "translateX(-50%)" : "translate(-50%, -100%)",
			}}
		>
			{tapped ? (
				<Link
					to="/birds/$comName"
					params={{ comName: comNameToSlug(bird.comName) }}
					tabIndex={-1}
					onClick={(event) => event.stopPropagation()}
					className="flex items-center gap-1 py-2 pr-1.5 pl-2.5"
				>
					<PopupLabel bird={bird} />
					<ChevronRight
						aria-hidden="true"
						className="size-4 text-muted-foreground"
					/>
				</Link>
			) : (
				<PopupLabel bird={bird} />
			)}
		</div>
	);
}

function PopupLabel({ bird }: { bird: ShownCollageBird }) {
	return (
		<span>
			<span className="font-semibold">{bird.comName}</span>
			{` — ${bird.count.toLocaleString()} ${plural(bird.count, "detection")}`}
		</span>
	);
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let settle: ReturnType<typeof setTimeout> | undefined;
		let measured = false;
		const observer = new ResizeObserver(([entry]) => {
			const width = Math.floor(entry.contentRect.width);
			const height = Math.floor(entry.contentRect.height);
			const apply = () =>
				setSize((previous) =>
					previous?.width === width && previous.height === height
						? previous
						: { width, height },
				);
			clearTimeout(settle);
			if (measured) settle = setTimeout(apply, RESIZE_SETTLE_MS);
			else apply();
			measured = true;
		});
		observer.observe(element);
		return () => {
			clearTimeout(settle);
			observer.disconnect();
		};
	}, [ref]);
	return size;
}

const SOLID_MASK: CollageMask = {
	width: 1,
	height: 1,
	filled: Uint8Array.of(1),
};

function useMasks(birds: ShownCollageBird[]): CollageMask[] | null {
	const [masks, setMasks] = useState<{
		birds: ShownCollageBird[];
		masks: CollageMask[];
	} | null>(null);
	useEffect(() => {
		let cancelled = false;
		Promise.all(
			birds.map((bird) =>
				bird.kind === "photo"
					? SOLID_MASK
					: maskFor(bird.imageUrl, bird.bounds).catch(() => SOLID_MASK),
			),
		).then((loaded) => {
			if (!cancelled) setMasks({ birds, masks: loaded });
		});
		return () => {
			cancelled = true;
		};
	}, [birds]);
	return masks?.birds === birds ? masks.masks : null;
}
