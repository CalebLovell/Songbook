import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
	SETTINGS_INDEX,
	type SettingsIndexEntry,
} from "~/components/settings/settings-index.ts";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { Count } from "~/components/ui/count.tsx";
import { Input } from "~/components/ui/input.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { getSearchSpecies } from "~/lib/search-species.ts";
import { SITE_PAGES, type SitePage } from "~/lib/site-pages.ts";
import { type SearchSpecies, searchSite } from "~/lib/site-search.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { cn } from "~/lib/utils.ts";

const SEARCH_INDEX_FRESH_MS = 5 * 60_000;

type Result =
	| { kind: "species"; species: SearchSpecies }
	| { kind: "page"; page: SitePage }
	| { kind: "setting"; setting: SettingsIndexEntry; field?: string };

function useSearchSpecies() {
	const [requested, setRequested] = useState(false);
	const { data: species } = useQuery({
		queryKey: ["search-species"],
		queryFn: () => getSearchSpecies(),
		enabled: requested,
		staleTime: SEARCH_INDEX_FRESH_MS,
	});

	return { species: species ?? [], load: () => setRequested(true) };
}

function useSlashShortcut(input: React.RefObject<HTMLInputElement | null>) {
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest("input, textarea, select, [contenteditable='true']")
			) {
				return;
			}
			if (!input.current?.offsetParent) return;
			event.preventDefault();
			input.current.focus();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [input]);
}

export function SiteSearch({ onNavigate }: { onNavigate?: () => void }) {
	const navigate = useNavigate();
	const input = useRef<HTMLInputElement>(null);
	const listId = useId();
	const [query, setQuery] = useState("");
	const [focused, setFocused] = useState(false);
	const [active, setActive] = useState(0);
	const { species, load } = useSearchSpecies();
	const { auth } = useRouteContext({ from: "__root__" });
	useSlashShortcut(input);

	const results = useMemo<Result[]>(() => {
		const trimmed = query.trim();
		if (trimmed === "") return [];
		const found = searchSite(
			trimmed,
			species,
			auth.unlocked ? SITE_PAGES : SITE_PAGES.filter((page) => !page.gated),
			auth.unlocked ? SETTINGS_INDEX : [],
		);
		return [
			...found.species.map((item) => ({
				kind: "species" as const,
				species: item,
			})),
			...found.pages.map((page) => ({ kind: "page" as const, page })),
			...found.settings.map((match) => ({
				kind: "setting" as const,
				...match,
			})),
		];
	}, [query, species, auth.unlocked]);

	const open = focused && results.length > 0;
	useAnnounceChange(
		query.trim()
			? `${results.length} ${results.length === 1 ? "result" : "results"}`
			: null,
	);

	function changeQuery(next: string) {
		setQuery(next);
		setActive(0);
	}

	function close() {
		changeQuery("");
		input.current?.blur();
	}

	function go(result: Result) {
		if (result.kind === "species") {
			navigate({
				to: "/birds/$comName",
				params: { comName: comNameToSlug(result.species.comName) },
			});
		} else if (result.kind === "page") {
			navigate({ to: result.page.to });
		} else {
			navigate({ to: "/settings", search: { tab: result.setting.tab } });
		}
		close();
		onNavigate?.();
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			close();
		} else if (!open) {
			return;
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((index) => (index + 1) % results.length);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => (index - 1 + results.length) % results.length);
		} else if (event.key === "Enter") {
			event.preventDefault();
			go(results[active]);
		}
	}

	const optionId = (index: number) => `${listId}-${index}`;
	const firstPage = results.findIndex((result) => result.kind === "page");
	const firstSetting = results.findIndex((result) => result.kind === "setting");

	return (
		<Popover.Root open={open}>
			<Popover.Anchor asChild>
				<div className="relative px-3 pb-3">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-[calc(50%+0.375rem)] text-muted-foreground"
					/>
					<Input
						ref={input}
						type="search"
						role="combobox"
						aria-label="Search the station"
						aria-expanded={open}
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={open ? optionId(active) : undefined}
						placeholder="Search…"
						autoComplete="off"
						spellCheck={false}
						value={query}
						onChange={(event) => changeQuery(event.target.value)}
						onFocus={() => {
							setFocused(true);
							load();
						}}
						onBlur={() => setFocused(false)}
						onKeyDown={onKeyDown}
						className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
					/>
					{query ? (
						<button
							type="button"
							aria-label="Clear search"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								changeQuery("");
								input.current?.focus();
							}}
							className="absolute top-0 right-3 bottom-3 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					) : null}
				</div>
			</Popover.Anchor>

			<Popover.Portal>
				<Popover.Content
					side="bottom"
					align="start"
					sideOffset={-6}
					alignOffset={8}
					collisionPadding={16}
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
					className="z-50 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-line bg-paper-raised py-1 shadow-[0_6px_18px_color-mix(in_oklab,var(--shade)_8%,transparent)]"
				>
					<div id={listId} role="listbox" aria-label="Search results">
						{results.map((result, index) => (
							<div key={resultKey(result)}>
								{index === 0 && result.kind === "species" ? (
									<GroupLabel>Birds</GroupLabel>
								) : null}
								{index === firstPage ? (
									<GroupLabel divided={index > 0}>Pages</GroupLabel>
								) : null}
								{index === firstSetting ? (
									<GroupLabel divided={index > 0}>Settings</GroupLabel>
								) : null}
								<div
									id={optionId(index)}
									role="option"
									aria-selected={index === active}
									tabIndex={-1}
									onMouseDown={(event) => {
										event.preventDefault();
										go(result);
									}}
									onMouseMove={() => setActive(index)}
									className={cn(
										"flex cursor-pointer items-center gap-2.5 px-3 py-1 text-sm",
										index === active && "bg-row-selected",
									)}
								>
									<ResultBody result={result} />
								</div>
							</div>
						))}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}

function resultKey(result: Result): string {
	if (result.kind === "species") return `s:${result.species.comName}`;
	if (result.kind === "page") return `p:${result.page.to}`;
	return `c:${result.setting.title}`;
}

function GroupLabel({
	divided = false,
	children,
}: {
	divided?: boolean;
	children: string;
}) {
	return (
		<Kicker
			className={cn(
				"px-3 pt-1.5 pb-1",
				divided && "mt-1 border-line border-t pt-2",
			)}
		>
			{children}
		</Kicker>
	);
}

function ResultBody({ result }: { result: Result }) {
	if (result.kind === "species") {
		const { comName, sciName, count } = result.species;
		return (
			<>
				<SpeciesThumbnail
					imageUrl={illustrationUrlFor(sciName)}
					comName={comName}
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate">{comName}</span>
					<span className="block truncate text-muted-foreground text-xs italic">
						{sciName}
					</span>
				</span>
				<Count>{count.toLocaleString()}</Count>
			</>
		);
	}

	if (result.kind === "page") {
		const Icon = result.page.icon;
		return (
			<>
				<Icon aria-hidden="true" className="size-4 shrink-0 text-moss" />
				<span className="py-1">{result.page.label}</span>
			</>
		);
	}

	const Icon = result.setting.icon;
	return (
		<>
			<Icon aria-hidden="true" className="size-4 shrink-0 text-moss" />
			<span className="py-1">{result.setting.title}</span>
			{result.field ? (
				<span className="min-w-0 truncate text-muted-foreground text-xs">
					{result.field}
				</span>
			) : null}
		</>
	);
}
