import { useMutation } from "@tanstack/react-query";
import {
	Download,
	type LucideIcon,
	MapPin,
	PenLine,
	Power,
	RadioTower,
	RefreshCw,
	RotateCcw,
	SlidersHorizontal,
	Upload,
} from "lucide-react";
import { useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	type HealthAction,
	type HealthCardView,
	type HealthTone,
	healthCards,
} from "~/lib/health-cards.ts";
import { describeAudioProblem, type StationHealth } from "~/lib/health-data.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import type { UpdateState } from "~/lib/updates-data.ts";
import { errorMessage } from "~/lib/utils.ts";
import { BackupButton } from "./backup-dialog.tsx";
import { DetectionButton, type DetectionEditing } from "./detection-dialog.tsx";
import { RestoreButton } from "./restore-dialog.tsx";
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
	onCheckAudio: () => Promise<StationHealth>;
	onInstallUpdate: () => Promise<void>;
	station: StationEditing | null;
	detection: DetectionEditing | null;
	automaticUpdates: AutomaticUpdates | null;
};

export type AutomaticUpdates = {
	automatic: boolean;
	save: (automatic: boolean) => Promise<unknown>;
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
			icon={RadioTower}
			title={PAGE_HEADERS.station.title}
			description={PAGE_HEADERS.station.description}
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
			id={card.id}
			aria-labelledby={titleId}
			className={`flex scroll-mt-4 flex-col gap-page overflow-hidden ${CARD_TONE_CLASS[card.tone] ?? ""}`}
		>
			<CardHeader
				titleId={titleId}
				title={card.title}
				className={HEADER_TONE_CLASS[card.tone] ?? ""}
			>
				{card.info ? (
					<InfoTip label={card.title} size="default">
						{card.info.map((line) => (
							<p key={line}>{line}</p>
						))}
					</InfoTip>
				) : null}
			</CardHeader>
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
			{card.automaticUpdates ? (
				<AutomaticUpdatesChoice setting={handlers.automaticUpdates} />
			) : null}
			{card.actions.length ? (
				<div className="mt-auto flex flex-wrap gap-page">
					{card.actions.map((action) => (
						<HealthActionButton
							key={action.kind}
							action={action}
							handlers={handlers}
						/>
					))}
				</div>
			) : null}
		</Card>
	);
}

function AutomaticUpdatesChoice({
	setting,
}: {
	setting: AutomaticUpdates | null;
}) {
	const labelId = "health-automatic-updates";
	const mutation = useMutation({
		mutationFn: (automatic: boolean) =>
			setting ? setting.save(automatic) : Promise.resolve(),
		onSuccess: (_, automatic) =>
			toast.success(
				automatic
					? "Updates now install by themselves overnight."
					: "Updates now wait for you to press Install.",
				{ id: "health-automatic-updates" },
			),
		onError: (error) =>
			toast.error(errorMessage(error, "Couldn't change automatic updates."), {
				id: "health-automatic-updates",
			}),
	});
	const automatic = mutation.isPending
		? mutation.variables
		: (setting?.automatic ?? true);
	return (
		<div className="flex flex-wrap items-center justify-between gap-page">
			<div>
				<p id={labelId} className="m-0 font-semibold text-base">
					Install automatically
				</p>
				<p className="m-0 text-muted-foreground text-sm leading-relaxed">
					Overnight, between 3 and 5 AM. Off, updates wait for Install.
				</p>
			</div>
			<ToggleGroup
				type="single"
				variant="outline"
				aria-labelledby={labelId}
				disabled={!setting || mutation.isPending}
				value={automatic ? "on" : "off"}
				onValueChange={(next) => {
					if (next) mutation.mutate(next === "on");
				}}
			>
				<ToggleGroupItem value="on">On</ToggleGroupItem>
				<ToggleGroupItem value="off">Off</ToggleGroupItem>
			</ToggleGroup>
		</div>
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
	if (action.kind === "tune-detection")
		return <DetectionButton editing={handlers.detection} />;
	if (action.kind === "restore-backup")
		return <RestoreButton primary={action.primary} />;
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
				check={action.kind === "edit-location" && action.check === true}
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
	if (action.kind === "check-audio")
		return <CheckAudioButton onCheck={handlers.onCheckAudio} />;
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
	check,
	editing,
}: {
	kind: "edit-name" | "edit-location";
	primary: boolean;
	check: boolean;
	editing: StationEditing | null;
}) {
	const [open, setOpen] = useState(false);
	const name = kind === "edit-name";
	const verb = check ? "Check" : primary ? "Set" : "Change";
	const label = `${verb} ${name ? "name" : "location"}`;
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

function CheckAudioButton({
	onCheck,
}: {
	onCheck: HealthHandlers["onCheckAudio"];
}) {
	const check = useMutation({
		mutationFn: onCheck,
		onSuccess: (health) => {
			const { problem } = health.checks.audio;
			if (problem)
				toast.error(describeAudioProblem(problem).title, {
					id: "health-audio",
				});
			else toast.success("Audio input is working.", { id: "health-audio" });
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Couldn't check the audio input."), {
				id: "health-audio",
			}),
	});
	return (
		<Button
			type="button"
			variant="default"
			size="default"
			icon={RefreshCw}
			loading={check.isPending}
			onClick={() => check.mutate()}
		>
			Check again
		</Button>
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
			toast.success(result.message, { id: "power" });
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
		buttons: [
			{ label: "Restart BirdNET", icon: RefreshCw },
			{ label: "Tune detection", icon: SlidersHorizontal },
		],
	},
	{ title: "Storage", meter: true, buttons: [] },
	{
		title: "Updates",
		buttons: [{ label: "Check for updates", icon: RefreshCw }],
	},
	{
		title: "Backups",
		buttons: [
			{ label: "Download a backup", icon: Download },
			{ label: "Restore a backup", icon: Upload },
		],
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
