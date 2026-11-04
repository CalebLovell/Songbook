import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";

export function YearSelector({
	year,
	years,
	onChange,
}: {
	year: number;
	years: number[];
	onChange: (year: number) => void;
}) {
	if (years.length <= 1) return null;

	const ascending = [...years].sort((a, b) => a - b);
	const previousYear = ascending.filter((it) => it < year).at(-1) ?? null;
	const nextYear = ascending.find((it) => it > year) ?? null;

	return (
		<div className="flex items-center gap-2 max-[400px]:gap-1.5">
			<Button
				variant="outline"
				size="icon-xs"
				className="max-[400px]:size-5"
				disabled={previousYear === null}
				aria-label="Previous year"
				onClick={() => previousYear !== null && onChange(previousYear)}
			>
				<ChevronLeft />
			</Button>
			<div className="tabular-data min-w-12 text-center font-semibold text-sm max-[400px]:min-w-10 max-[400px]:text-xs">
				{year}
			</div>
			<Button
				variant="outline"
				size="icon-xs"
				className="max-[400px]:size-5"
				disabled={nextYear === null}
				aria-label="Next year"
				onClick={() => nextYear !== null && onChange(nextYear)}
			>
				<ChevronRight />
			</Button>
		</div>
	);
}
