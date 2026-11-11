import { useMutation } from "@tanstack/react-query";
import {
	ArrowRight,
	Download,
	HeartPulse,
	type LucideIcon,
	MapPin,
	PenLine,
	Power,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ButtonLink } from "~/components/ui/button-link.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import {
	type HealthAction,
	type HealthCardView,
	type HealthTone,
	healthCards,
} from "~/lib/health-cards.ts";
import type { StationHealth } from "~/lib/health-data.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import type { UpdateState } from "~/lib/updates-data.ts";
import { errorMessage } from "~/lib/utils.ts";
import { BackupButton } from "./backup-dialog.tsx";
import {
	LocationDialog,
	type StationEditing,
	StationNameDialog,
} from "./station-dialogs.tsx";

export type PowerAction = "reboot" | "poweroff";

export type HealthHandlers = {
	onRestartBirdnet: () => Promise<{ message: string }>;
	onPower: (action: PowerAction) => Promise<{ message: string }>;
	onCheckUpdates: () => Promise<UpdateState>;
	onInstallUpdate: () => Promise<void>;
	station: StationEditing | null;
};

const GRID_CLASS =
	"grid grid-cols-1 gap-page @3xl:grid-cols-2 @6xl:grid-cols-3";

const CARD_TONE_CLASS: Partial<Record<HealthTone, string>> = {
	problem: "border-toast-error-line",
	warning: "border-toast-warning-line",
	setup: "border-toast-warning-line",
};

const HEADER_TONE_CLASS: Partial<Record<HealthTone, string>> = {
	problem: "border-toast-error-line bg-toast-error-fill [&>h2]:text-clay",
	warning: "border-toast-warning-line bg-toast-warning-fill [&>h2]:text-bark",
	setup: "border-toast-warning-line bg-toast-warning-fill [&>h2]:text-bark",
};

const PROBLEM_TITLE_CLASS: Record<HealthTone, string> = {
	ok: "text-ink",
	problem: "text-clay",
	warning: "text-bark",
	setup: "text-ink",
	unknown: "text-ink",
};

const FIGURE_CLASS = "font-semibold text-xl tabular-nums leading-tight";

const POWER_COPY: Record<
	PowerAction,
	{
		title: string;
		description: string;
		confirm: string;
		pending: string;
		destructive: boolean;
	}
> = {
	reboot: {
		title: "Restart the Pi?",
		description:
			"The station stops listening for a minute or two while the Pi starts again, then carries on by itself.",
		confirm: "Restart the Pi",
		pending: "Restarting the Pi…",
		destructive: false,
	},
	poweroff: {
		title: "Shut down the Pi?",
		description:
			"The station stops listening until the Pi is unplugged and plugged back in. Shut down before unplugging it, to keep its memory card safe.",
		confirm: "Shut down",
		pending: "Shutting down…",
		destructive: true,
	},
};

export function HealthPage({
	health,
	updates,
	handlers,
}: {
	health: StationHealth;
	updates: UpdateState | null;
	handlers: HealthHandlers;
}) {
	const cards = healthCards(health, updates);
	return (
		<PageWrap className="@container space-y-page">
			<HealthHeader />
			<div className={GRID_CLASS}>
				{cards.map((card) => (
					<HealthCard key={card.id} card={card} handlers={handlers} />
				))}
			</div>
		</PageWrap>
	);
}

function HealthHeader() {
	return (
		<PageHeaderCard
			icon={HeartPulse}
			title={PAGE_HEADERS.health.title}
			description={PAGE_HEADERS.health.description}
		/>
	);
}

function HealthCard({
	card,
	handlers,
}: {
	card: HealthCardView;
	handlers: HealthHandlers;
}) {
	const titleId = `health-${card.id}`;
	return (
		<Card
			as="section"
			aria-labelledby={titleId}
			className={`flex flex-col gap-page overflow-hidden ${CARD_TONE_CLASS[card.tone] ?? ""}`}
		>
			<CardHeader
				titleId={titleId}
				title={card.title}
				className={HEADER_TONE_CLASS[card.tone] ?? ""}
			/>
			<div className="flex flex-col gap-2">
				{card.figure ? (
					<p
						className={`m-0 ${FIGURE_CLASS} ${card.tone === "unknown" ? "text-muted-foreground" : ""}`}
					>
						{card.figure}
					</p>
				) : null}
				{card.meter ? (
					<Meter {...card.meter} hot={card.tone === "problem"} />
				) : null}
				{card.problem ? (
					<div>
						<h3
							className={`m-0 font-semibold text-base ${PROBLEM_TITLE_CLASS[card.tone]}`}
						>
							{card.problem.title}
						</h3>
						<p
							className={`m-0 text-sm leading-relaxed ${card.tone === "problem" ? "text-bark" : "text-muted-foreground"}`}
						>
							{card.problem.detail}
						</p>
					</div>
				) : null}
				{card.problem
					? null
					: card.details.map((line) => (
							<p
								key={line}
								className="m-0 text-muted-foreground text-sm leading-relaxed"
							>
								{line}
							</p>
						))}
			</div>
			{card.actions.length ? (
				<div className="mt-auto flex flex-wrap gap-page">
					{card.actions.map((action) => (
						<HealthActionButton
							key={action.kind === "setting" ? action.label : action.kind}
							action={action}
							handlers={handlers}
						/>
					))}
				</div>
			) : null}
		</Card>
	);
}

function Meter({
	usedPercent,
	threshold,
	hot,
}: {
	usedPercent: number;
	threshold: number | null;
	hot: boolean;
}) {
	return (
		<div aria-hidden="true" className="relative h-2 rounded-full bg-track">
			<span
				className={`absolute inset-y-0 left-0 rounded-full ${hot ? "bg-clay" : "bg-moss"}`}
				style={{ width: `${Math.min(100, usedPercent)}%` }}
			/>
			{threshold !== null ? (
				<span
					className="absolute -inset-y-1 w-0.5 rounded-full bg-ink opacity-50"
					style={{ left: `${threshold}%` }}
				/>
			) : null}
		</div>
	);
}

function HealthActionButton({
	action,
	handlers,
}: {
	action: HealthAction;
	handlers: HealthHandlers;
}) {
	if (action.kind === "setting")
		return (
			<ButtonLink
				to="/settings"
				search={{ tab: action.tab }}
				variant={action.primary ? "default" : "outline"}
				size="default"
				icon={ArrowRight}
				iconPosition="end"
			>
				{action.label}
			</ButtonLink>
		);
	if (action.kind === "restart-birdnet")
		return (
			<RestartBirdnetButton
				primary={action.primary}
				onRestart={handlers.onRestartBirdnet}
			/>
		);
	if (action.kind === "edit-name" || action.kind === "edit-location")
		return (
			<StationEditButton
				kind={action.kind}
				primary={action.primary}
				editing={handlers.station}
			/>
		);
	if (action.kind === "download-backup") return <BackupButton />;
	if (action.kind === "check-updates")
		return (
			<CheckUpdatesButton
				busy={action.busy}
				onCheck={handlers.onCheckUpdates}
			/>
		);
	if (action.kind === "install-update")
		return (
			<InstallUpdateButton
				version={action.version}
				onInstall={handlers.onInstallUpdate}
			/>
		);
	return <PowerButton action={action.kind} onPower={handlers.onPower} />;
}

function StationEditButton({
	kind,
	primary,
	editing,
}: {
	kind: "edit-name" | "edit-location";
	primary: boolean;
	editing: StationEditing | null;
}) {
	const [open, setOpen] = useState(false);
	const name = kind === "edit-name";
	const label = `${primary ? "Set" : "Change"} ${name ? "name" : "location"}`;
	return (
		<>
			<Button
				type="button"
				variant={primary ? "default" : "outline"}
				size="default"
				icon={name ? PenLine : MapPin}
				disabled={!editing}
				onClick={() => setOpen(true)}
			>
				{label}
			</Button>
			{open && editing ? (
				name ? (
					<StationNameDialog editing={editing} onClose={() => setOpen(false)} />
				) : (
					<LocationDialog editing={editing} onClose={() => setOpen(false)} />
				)
			) : null}
		</>
	);
}

function CheckUpdatesButton({
	busy,
	onCheck,
}: {
	busy: boolean;
	onCheck: HealthHandlers["onCheckUpdates"];
}) {
	const check = useMutation({
		mutationFn: onCheck,
		onSuccess: (result) => {
			if (result.state === "failed")
				toast.error(result.message ?? "Couldn't look for updates.", {
					id: "health-updates",
				});
			else
				toast.success(
					result.message ??
						(result.latest &&
						result.latest.version !== result.installed?.version
							? "An update is available."
							: "Up to date."),
					{ id: "health-updates" },
				);
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Couldn't look for updates."), {
				id: "health-updates",
			}),
	});
	return (
		<Button
			type="button"
			variant="outline"
			size="default"
			icon={RefreshCw}
			loading={check.isPending || busy}
			onClick={() => check.mutate()}
		>
			Check for updates
		</Button>
	);
}

function InstallUpdateButton({
	version,
	onInstall,
}: {
	version: string;
	onInstall: HealthHandlers["onInstallUpdate"];
}) {
	const [asking, setAsking] = useState(false);
	const install = useMutation({
		mutationFn: onInstall,
		onSettled: () => setAsking(false),
		onError: (error) =>
			toast.error(errorMessage(error, "Couldn't start the update."), {
				id: "health-updates",
			}),
	});
	return (
		<>
			<Button
				type="button"
				size="default"
				icon={Download}
				loading={install.isPending}
				onClick={() => setAsking(true)}
			>
				Install {version}
			</Button>
			{asking ? (
				<ConfirmDialog
					title={`Install ${version}?`}
					description="The station installs the new release and restarts. Recording stops for about a minute, and this page comes back when the station does. If the new version doesn't start, the station goes back to the one it has now."
					confirmLabel="Install now"
					confirmIcon={Download}
					pending={install.isPending}
					onCancel={() => setAsking(false)}
					onConfirm={() => install.mutate()}
				/>
			) : null}
		</>
	);
}

function RestartBirdnetButton({
	primary,
	onRestart,
}: {
	primary: boolean;
	onRestart: HealthHandlers["onRestartBirdnet"];
}) {
	const restart = useMutation({
		mutationFn: onRestart,
		onMutate: () =>
			toast.loading("Restarting BirdNET…", { id: "restart-birdnet" }),
		onSuccess: (result) =>
			toast.success(result.message, { id: "restart-birdnet" }),
		onError: (error) =>
			toast.warning(errorMessage(error, "BirdNET could not be restarted."), {
				id: "restart-birdnet",
				duration: 10_000,
			}),
	});
	return (
		<Button
			type="button"
			variant={primary ? "default" : "outline"}
			size="default"
			icon={RefreshCw}
			loading={restart.isPending}
			onClick={() => restart.mutate()}
		>
			Restart BirdNET
		</Button>
	);
}

function PowerButton({
	action,
	onPower,
}: {
	action: PowerAction;
	onPower: HealthHandlers["onPower"];
}) {
	const [asking, setAsking] = useState(false);
	const copy = POWER_COPY[action];
	const power = useMutation({
		mutationFn: () => onPower(action),
		onSuccess: (result) => {
			setAsking(false);
			if (copy.destructive) destructiveToast(result.message, { id: "power" });
			else toast.success(result.message, { id: "power" });
		},
		onError: (error) => {
			setAsking(false);
			toast.warning(errorMessage(error, "The Pi didn't respond. Try again."), {
				id: "power",
				duration: 10_000,
			});
		},
	});
	const Icon = action === "reboot" ? RotateCcw : Power;
	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="default"
				icon={Icon}
				className={copy.destructive ? "text-clay" : ""}
				onClick={() => setAsking(true)}
			>
				{copy.confirm}
			</Button>
			{asking ? (
				<ConfirmDialog
					title={copy.title}
					description={copy.description}
					confirmLabel={power.isPending ? copy.pending : copy.confirm}
					confirmIcon={Icon}
					destructive={copy.destructive}
					pending={power.isPending}
					onCancel={() => setAsking(false)}
					onConfirm={() => power.mutate()}
				/>
			) : null}
		</>
	);
}

type SkeletonButton = { label: string; icon: LucideIcon };

const SKELETON_CARDS: {
	title: string;
	meter?: boolean;
	buttons: SkeletonButton[];
}[] = [
	{ title: "Name", buttons: [{ label: "Change name", icon: PenLine }] },
	{ title: "Location", buttons: [{ label: "Change location", icon: MapPin }] },
	{ title: "Audio input", buttons: [] },
	{
		title: "Power supply",
		buttons: [
			{ label: "Restart the Pi", icon: RotateCcw },
			{ label: "Shut down", icon: Power },
		],
	},
	{
		title: "BirdNET model",
		buttons: [{ label: "Restart BirdNET", icon: RefreshCw }],
	},
	{ title: "Storage", meter: true, buttons: [] },
	{
		title: "Updates",
		buttons: [{ label: "Check for updates", icon: RefreshCw }],
	},
	{
		title: "Backups",
		buttons: [{ label: "Download a backup", icon: Download }],
	},
];

export function HealthPageSkeleton() {
	return (
		<PageWrap className="@container space-y-page">
			<HealthHeader />
			<div className={GRID_CLASS} aria-busy="true">
				{SKELETON_CARDS.map(({ title, meter, buttons }) => (
					<Card
						key={title}
						as="section"
						aria-label={title}
						className="flex flex-col gap-page"
					>
						<CardHeader title={title} />
						<div className="flex flex-col gap-2">
							<ShellText className={FIGURE_CLASS} barClassName="w-40" />
							{meter ? <ShellBar className="h-2 w-full rounded-full" /> : null}
							<ShellText
								className="text-sm leading-relaxed"
								barClassName="w-4/5"
							/>
						</div>
						{buttons.length ? (
							<div className="mt-auto flex flex-wrap gap-page">
								{buttons.map(({ label, icon }) => (
									<ShellSized key={label}>
										<Button
											type="button"
											variant="outline"
											size="default"
											icon={icon}
											tabIndex={-1}
										>
											{label}
										</Button>
									</ShellSized>
								))}
							</div>
						) : null}
					</Card>
				))}
			</div>
		</PageWrap>
	);
}
