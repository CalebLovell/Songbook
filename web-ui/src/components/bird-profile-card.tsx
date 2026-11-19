import type { ReactNode } from "react";

import { SpeciesImage } from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ShellBar, ShellText } from "~/components/ui/shell.tsx";
import { cn } from "~/lib/utils.ts";

const PROFILE_CARD_CLASS =
	"grid overflow-hidden p-0 sm:grid-cols-[11.5rem_minmax(0,1fr)]";
const PROFILE_PORTRAIT_CLASS =
	"flex h-34 items-center justify-center overflow-hidden p-4 pb-0 sm:h-38 sm:self-center sm:pb-4";
const PROFILE_TEXT_CLASS =
	"flex min-w-0 flex-col justify-center gap-3 p-4 sm:min-h-39 sm:justify-between sm:pl-0";

export function BirdProfileCard({
	label = "Bird profile",
	imageUrl,
	comName,
	name,
	sciName,
	line,
	actions,
	className,
}: {
	label?: string;
	imageUrl: string | null;
	comName: string;
	name?: ReactNode;
	sciName: ReactNode;
	line: ReactNode;
	actions: ReactNode;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-label={label}
			className={cn(PROFILE_CARD_CLASS, className)}
		>
			<div className={PROFILE_PORTRAIT_CLASS}>
				<SpeciesImage
					imageUrl={imageUrl}
					alt={comName}
					glyphClassName="size-16"
					cropToPainting
				/>
			</div>

			<div className={PROFILE_TEXT_CLASS}>
				<div className="min-w-0">
					<h1 className="font-bold text-2xl text-moss sm:text-3xl">
						{name ?? comName}
					</h1>
					<p className="text-bark text-xs italic">{sciName}</p>
				</div>
				<div className="text-muted-foreground text-sm tabular-nums">{line}</div>
				{actions}
			</div>
		</Card>
	);
}

export function BirdProfileCardShell({
	label = "Bird profile",
	portrait,
	actions,
	className,
}: {
	label?: string;
	portrait?: ReactNode;
	actions: ReactNode;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label={label}
			className={cn(PROFILE_CARD_CLASS, className)}
		>
			<div className={PROFILE_PORTRAIT_CLASS}>
				{portrait ?? <ShellBar className="size-full rounded-md" />}
			</div>
			<div aria-hidden="true" className={PROFILE_TEXT_CLASS}>
				<div className="min-w-0">
					<ShellText
						className="font-bold text-2xl sm:text-3xl"
						barClassName="w-64 max-w-full"
					/>
					<ShellText className="text-xs" barClassName="w-32" />
				</div>
				<ShellText className="text-sm" barClassName="w-80 max-w-full" />
				<div className="relative z-10 flex flex-wrap items-center gap-2">
					{actions}
				</div>
			</div>
		</Card>
	);
}
