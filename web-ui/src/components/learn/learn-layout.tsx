import {
	Binoculars,
	Footprints,
	Gem,
	Infinity as InfinityIcon,
	RotateCcw,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "~/components/ui/button.tsx";
import { Count } from "~/components/ui/count.tsx";
import { IconSelect } from "~/components/ui/icon-select.tsx";
import { ShellFigure } from "~/components/ui/shell.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	LEARN_POOL_LABELS,
	LEARN_POOLS,
	type LearnPool,
} from "~/lib/learn-pools.ts";

const LEARN_POOL_ICONS: Record<
	LearnPool,
	ComponentType<{ className?: string }>
> = {
	common: Footprints,
	uncommon: Binoculars,
	rare: Gem,
	all: InfinityIcon,
};

type PoolCounts = Record<LearnPool, number> | null;

export function LearnPoolSelector({
	pool,
	poolCounts,
	onPoolChange,
	onNewRound,
}: {
	pool: LearnPool;
	poolCounts: PoolCounts;
	onPoolChange: (pool: LearnPool) => void;
	onNewRound?: () => void;
}) {
	return (
		<div className="mt-page flex items-center justify-between gap-page">
			<PoolSelect
				pool={pool}
				poolCounts={poolCounts}
				onPoolChange={onPoolChange}
			/>
			<div className="hidden sm:block">
				<ToggleGroup
					type="single"
					variant="outline"
					aria-label="Which birds"
					value={pool}
					onValueChange={(value) => {
						if (value) onPoolChange(value as LearnPool);
					}}
				>
					{LEARN_POOLS.map((option) => {
						const Icon = LEARN_POOL_ICONS[option];
						return (
							<ToggleGroupItem key={option} value={option}>
								<Icon className="size-4" />
								{LEARN_POOL_LABELS[option]}
								<PoolCount count={poolCounts?.[option]} />
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			</div>
			{onNewRound ? (
				<Button
					variant="outline"
					size="lg"
					icon={RotateCcw}
					className="px-3 max-[400px]:w-8.5 pointer-coarse:max-[400px]:w-9 max-[400px]:px-0 pointer-coarse:sm:max-md:w-9 sm:max-md:w-8.5 sm:max-md:px-0"
					onClick={onNewRound}
				>
					<span className="max-[400px]:sr-only sm:max-md:sr-only">Restart</span>
				</Button>
			) : null}
		</div>
	);
}

function PoolCount({ count }: { count: number | undefined }) {
	return (
		<Count className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 in-data-[state=on]:bg-primary-foreground/20 px-1.5 in-data-[state=on]:text-primary-foreground! leading-5">
			{count === undefined ? <ShellFigure className="w-[1.6ch]!" /> : count}
		</Count>
	);
}

function PoolSelect({
	pool,
	poolCounts,
	onPoolChange,
}: {
	pool: LearnPool;
	poolCounts: PoolCounts;
	onPoolChange: (pool: LearnPool) => void;
}) {
	return (
		<IconSelect
			icon={LEARN_POOL_ICONS[pool]}
			label="Which birds"
			value={pool}
			onChange={onPoolChange}
			className="sm:hidden"
			options={LEARN_POOLS.map((option) => ({
				value: option,
				label: poolCounts
					? `${LEARN_POOL_LABELS[option]} (${poolCounts[option]})`
					: LEARN_POOL_LABELS[option],
			}))}
		/>
	);
}
