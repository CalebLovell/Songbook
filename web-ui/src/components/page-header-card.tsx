import type { ComponentType, ReactNode } from "react";
import { Card } from "~/components/ui/card.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";

export type PageHeaderStat = {
	label: string;
	value: ReactNode;
	icon: ComponentType<{ className?: string }>;
};

const COLUMN_CLASSES: Record<number, string> = {
	1: "lg:grid-cols-1",
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-3",
	4: "lg:grid-cols-4",
};

export function PageHeaderCard({
	icon: Icon,
	title,
	description,
	stats = [],
	action,
	afterHeader,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	description: ReactNode;
	stats?: PageHeaderStat[];
	action?: ReactNode;
	afterHeader?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<section aria-label={title} className="space-y-page">
			<Card className="flex min-h-masthead flex-col justify-center px-4 py-3">
				<div className="flex items-start justify-between gap-3 max-[400px]:flex-col max-[400px]:gap-2">
					<div className="flex min-w-0 items-center gap-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-well text-moss max-md:hidden">
							<Icon aria-hidden="true" className="size-5" />
						</div>
						<div className="min-w-0">
							<h1 className="font-bold text-xl leading-tight">{title}</h1>
							<p className="mt-1 text-muted-foreground text-sm **:data-[slot=count]:leading-none">
								{description}
							</p>
						</div>
					</div>
					{action}
				</div>

				{children}
			</Card>

			{afterHeader}

			{stats.length > 0 && <PageHeaderStats stats={stats} />}
		</section>
	);
}

function PageHeaderStats({
	stats,
	className = "",
	inline = false,
}: {
	stats: PageHeaderStat[];
	className?: string;
	inline?: boolean;
}) {
	const columns = COLUMN_CLASSES[Math.min(stats.length, 4)] ?? "lg:grid-cols-4";

	if (inline) {
		return (
			<dl
				className={`mt-4 grid grid-cols-2 gap-4 border-line border-t pt-4 ${columns} ${className}`}
			>
				{stats.map((stat) => (
					<Figure key={stat.label} {...stat} inline />
				))}
			</dl>
		);
	}

	return (
		<dl
			className={`grid grid-cols-1 gap-page sm:grid-cols-2 ${columns} ${className}`}
		>
			{stats.map((stat) => (
				<Figure key={stat.label} {...stat} />
			))}
		</dl>
	);
}

function Figure({
	label,
	value,
	icon: Icon,
	inline = false,
}: PageHeaderStat & { inline?: boolean }) {
	const figure = (
		<>
			<div className="flex @max-[15rem]/figure:hidden size-8 shrink-0 items-center justify-center rounded-full bg-icon-well text-moss">
				<Icon aria-hidden="true" className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<Kicker as="dt">{label}</Kicker>
				<dd className="mt-2 min-h-7 truncate font-semibold @max-[16rem]/figure:text-base text-xl tabular-nums leading-tight max-[400px]:mt-1 max-[400px]:min-h-6 max-[400px]:text-lg">
					{typeof value === "number" ? value.toLocaleString() : value}
				</dd>
			</div>
		</>
	);
	return inline ? (
		<div className="flex items-center gap-4 overflow-hidden">{figure}</div>
	) : (
		<Card className="@container/figure flex items-center gap-4 overflow-hidden max-[400px]:gap-3">
			{figure}
		</Card>
	);
}
