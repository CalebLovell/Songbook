import type { ReactNode } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Card } from "~/components/ui/card.tsx";
import { cn } from "~/lib/utils.ts";

export function ShellBar({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn("block animate-pulse rounded bg-muted", className)}
		/>
	);
}

export function ShellFigure({
	placeholder = "0",
	className,
}: {
	placeholder?: string;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			style={{ width: `${placeholder.length}ch` }}
			className={cn(
				"inline-block h-[0.8em] animate-pulse rounded-sm bg-muted align-[-0.05em]",
				className,
			)}
		/>
	);
}

export function ShellText({
	className,
	barClassName,
	strut,
}: {
	className?: string;
	barClassName?: string;
	strut?: ReactNode;
}) {
	return (
		<span aria-hidden="true" className={cn("relative block", className)}>
			{strut ?? <>&nbsp;</>}
			<ShellBar
				className={cn("absolute top-[18%] bottom-[18%] left-0", barClassName)}
			/>
		</span>
	);
}

export function ShellSized({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className="pointer-events-none relative inline-flex align-top"
		>
			<span className="invisible inline-flex">{children}</span>
			<ShellBar className={cn("absolute inset-0", className)} />
		</span>
	);
}

export function ShellLines({
	widths = ["w-4/5", "w-3/5", "w-2/3"],
	className,
}: {
	widths?: string[];
	className?: string;
}) {
	return (
		<span className={cn("flex flex-col gap-3 py-2", className)}>
			{widths.map((width, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
				<ShellBar key={index} className={cn("h-3.5", width)} />
			))}
		</span>
	);
}

export function ShellChartCard({
	title,
	ariaLabel,
	action,
	className = "",
}: {
	title: string;
	ariaLabel: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label={ariaLabel}
			className={cn("flex min-h-72 flex-col", className)}
		>
			<CardHeader title={title}>{action}</CardHeader>
			<ShellBar className="mt-page min-h-50 w-full flex-1 rounded-md" />
		</Card>
	);
}
