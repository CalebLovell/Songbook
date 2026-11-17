import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { useCanListen } from "~/lib/use-can-listen.ts";

const HERO_CARD_ROW =
	"grid items-center gap-page sm:min-h-31 sm:grid-cols-[9.5rem_minmax(0,1fr)]";

const HERO_CARD_FOOTER = "sm:pl-[calc(9.5rem+var(--page-gap))]";

export const HERO_PORTRAIT_SLOT =
	"flex h-30 w-full shrink-0 items-center justify-center";

export const HERO_ACTIONS_CLASS = "max-sm:hidden";

export function HeroCardShell({
	label,
	portrait,
	className = "",
	style,
	actions,
	footer,
	children,
}: {
	label: string;
	portrait: ReactNode;
	actions?: ReactNode;
	className?: string;
	style?: CSSProperties;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card as="section" aria-label={label} className={className} style={style}>
			{actions ? (
				<div className="mb-2 flex justify-end sm:hidden">{actions}</div>
			) : null}
			<div className={HERO_CARD_ROW}>
				{portrait}

				<div className="flex min-w-0 flex-col gap-2.5 max-[400px]:gap-2 sm:justify-between sm:self-stretch">
					{children}
				</div>
			</div>

			{footer ? <div className={HERO_CARD_FOOTER}>{footer}</div> : null}
		</Card>
	);
}

function HeroPortrait({
	imageUrl,
	comName,
}: {
	imageUrl: string | null;
	comName: string;
}) {
	return (
		<div className={`${HERO_PORTRAIT_SLOT} overflow-hidden`}>
			<SpeciesImage
				imageUrl={imageUrl}
				alt={comName}
				glyphClassName="size-16"
				cropToPainting
			/>
		</div>
	);
}

export function SpeciesHeroCard({
	label,
	comName,
	sciName,
	speciesSlug,
	imageUrl,
	relativeTime,
	heardAt,
	confidence,
	audioUrl,
	actions,
	footer,
	className,
	style,
}: {
	label: string;
	comName: string;
	sciName: string;
	speciesSlug?: string;
	imageUrl: string | null;
	relativeTime: string;
	heardAt: string;
	confidence: number | null;
	audioUrl: string | null;
	actions?: ReactNode;
	footer?: ReactNode;
	className?: string;
	style?: CSSProperties;
}) {
	const canListen = useCanListen();
	return (
		<HeroCardShell
			label={label}
			portrait={<HeroPortrait imageUrl={imageUrl} comName={comName} />}
			className={className}
			style={style}
			actions={actions}
			footer={footer}
		>
			<div className="flex flex-wrap items-start justify-between gap-3 max-[400px]:gap-2">
				<div className="min-w-0">
					<h1 className="font-bold text-2xl text-moss sm:text-3xl">
						{speciesSlug ? (
							<Link
								to="/birds/$comName"
								params={{ comName: speciesSlug }}
								className="no-underline hover:underline"
							>
								{comName}
							</Link>
						) : (
							comName
						)}
					</h1>
					<p className="text-bark text-xs italic">{sciName}</p>
				</div>
				{actions ? <div className={HERO_ACTIONS_CLASS}>{actions}</div> : null}
			</div>

			<div>
				<p className="font-semibold text-lg text-moss">{relativeTime}</p>
				<div className="mt-1 flex flex-wrap items-center gap-2 text-sm tabular-nums">
					<span className="text-muted-foreground">last heard {heardAt}</span>
					<ConfidencePill confidence={confidence} />
					{canListen ? (
						<RecordingButton
							audioUrl={audioUrl}
							speciesName={comName}
							size="sm"
						/>
					) : null}
				</div>
			</div>
		</HeroCardShell>
	);
}

export type HeroShellBird = {
	comName: string;
	sciName: string;
	relativeTime: string;
	heardAt: string;
	confidence: number | null;
};

const SAMPLE_HEARD_AT = "last heard Nov 17, 2026, 10:45 AM";

export function SpeciesHeroCardShell({
	label,
	actions,
	bird,
}: {
	label: string;
	actions?: ReactNode;
	bird?: HeroShellBird;
}) {
	return (
		<HeroCardShell
			label={label}
			actions={actions}
			portrait={
				<div className={HERO_PORTRAIT_SLOT}>
					<ShellBar className="size-full rounded-md" />
				</div>
			}
		>
			<HeroTextShell actions={actions} bird={bird} />
		</HeroCardShell>
	);
}

function TextStrut({
	text,
	className = "",
}: {
	text: string;
	className?: string;
}) {
	return (
		<ShellText
			className={`w-fit max-w-full ${className}`}
			barClassName="right-0"
			strut={<span className="invisible">{text}</span>}
		/>
	);
}

export function HeroTextShell({
	actions,
	bird,
}: {
	actions?: ReactNode;
	bird?: HeroShellBird;
}) {
	const canListen = useCanListen();
	const confidence = bird ? bird.confidence : 0.9;
	return (
		<>
			<div className="flex flex-wrap items-start justify-between gap-3 max-[400px]:gap-2">
				<div className="min-w-0 flex-1">
					{bird ? (
						<>
							<TextStrut
								text={bird.comName}
								className="font-bold text-2xl sm:text-3xl"
							/>
							<TextStrut text={bird.sciName} className="text-xs italic" />
						</>
					) : (
						<>
							<ShellText
								className="font-bold text-2xl sm:text-3xl"
								barClassName="w-60 max-w-full"
							/>
							<ShellText className="text-xs" barClassName="w-32" />
						</>
					)}
				</div>
				{actions ? <div className={HERO_ACTIONS_CLASS}>{actions}</div> : null}
			</div>

			<div>
				{bird ? (
					<TextStrut
						text={bird.relativeTime}
						className="font-semibold text-lg"
					/>
				) : (
					<ShellText className="font-semibold text-lg" barClassName="w-32" />
				)}
				<div className="mt-1 flex flex-wrap items-center gap-2 text-sm tabular-nums">
					<TextStrut
						text={bird ? `last heard ${bird.heardAt}` : SAMPLE_HEARD_AT}
					/>
					{confidence != null ? (
						<ShellSized className="rounded-full">
							<ConfidencePill confidence={confidence} />
						</ShellSized>
					) : null}
					{canListen ? (
						<ShellSized className="rounded-md">
							<RecordingButton audioUrl={null} size="sm" />
						</ShellSized>
					) : null}
				</div>
			</div>
		</>
	);
}
