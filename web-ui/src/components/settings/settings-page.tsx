import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import type { StationHealth } from "~/lib/health-data.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import type { SettingsPageData } from "~/lib/settings-data.ts";
import type { UpdateState } from "~/lib/updates-data.ts";
import { errorMessage } from "~/lib/utils.ts";
import { RestartButton } from "./restart-button.tsx";
import {
	SettingsCards,
	SettingsCardsSkeleton,
	type SettingsRestarter,
	type SettingsSavers,
} from "./settings-cards.tsx";
import type { SettingsTab } from "./settings-index.ts";
import { SettingsReset } from "./settings-reset.tsx";
import { SettingsToolbar } from "./settings-toolbar.tsx";
import { StationToDos } from "./station-to-dos.tsx";

type ResetOutcome = { message: string; needsRestart: boolean };

const RESTART_TOAST_ID = "settings-reset";

async function restartWithToast(onRestart: SettingsRestarter) {
	toast.loading("Restarting BirdNET…", { id: RESTART_TOAST_ID });
	try {
		const result = await onRestart(undefined);
		toast.success(result.message, { id: RESTART_TOAST_ID });
		return true;
	} catch (error) {
		toast.warning(errorMessage(error, "BirdNET could not be restarted."), {
			id: RESTART_TOAST_ID,
			duration: 10_000,
		});
		return false;
	}
}

export function SettingsPage({
	tab,
	onTabChange,
	data,
	savers = {},
	onReset,
	onRestart,
	health,
	updates,
	onCheckUpdates,
	onInstallUpdate,
}: {
	tab: SettingsTab;
	onTabChange: (next: SettingsTab) => void;
	data: SettingsPageData;
	savers?: SettingsSavers;
	health?: StationHealth;
	onReset?: () => Promise<ResetOutcome>;
	onRestart?: SettingsRestarter;
	updates?: UpdateState | null;
	onCheckUpdates?: () => Promise<UpdateState>;
	onInstallUpdate?: () => Promise<void>;
}) {
	const [needsRestart, setNeedsRestart] = useState(false);
	const [settingToReveal, setSettingToReveal] = useState<SettingsTab | null>(
		null,
	);

	useEffect(() => {
		if (settingToReveal !== tab) return;
		document.getElementById(settingToReveal)?.scrollIntoView();
		setSettingToReveal(null);
	}, [settingToReveal, tab]);

	const loadedValues = JSON.stringify([
		data.station,
		data.detection,
		data.audio,
		data.recording,
		data.storage,
		data.review,
		data.highlights,
		data.updates,
	]);

	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={Settings}
				title={PAGE_HEADERS.settings.title}
				description={PAGE_HEADERS.settings.description}
				afterHeader={
					<SettingsToolbar
						tab={tab}
						onTabChange={onTabChange}
						actions={
							onReset ? (
								<>
									{needsRestart && onRestart ? (
										<RestartButton
											size="lg"
											onRestart={async () => {
												if (await restartWithToast(onRestart))
													setNeedsRestart(false);
											}}
										/>
									) : null}
									<SettingsReset
										onReset={async () => {
											const outcome = await onReset();
											setNeedsRestart(outcome.needsRestart);
											if (outcome.needsRestart) {
												toast.warning(outcome.message, {
													id: "settings-reset",
													duration: 10_000,
												});
											} else {
												destructiveToast(outcome.message, {
													id: "settings-reset",
												});
											}
										}}
									/>
								</>
							) : null
						}
					/>
				}
			/>
			<StationToDos
				toDos={health?.toDos ?? []}
				onShowSetting={(next) => {
					setSettingToReveal(next);
					onTabChange(next);
				}}
				onRestart={async () => {
					if (onRestart) await restartWithToast(onRestart);
				}}
			/>
			<SettingsCards
				key={loadedValues}
				tab={tab}
				data={data}
				savers={savers}
				restarter={onRestart}
				diskUsedPercent={health?.diskUsedPercent ?? null}
				updates={updates}
				onCheckUpdates={onCheckUpdates}
				onInstallUpdate={onInstallUpdate}
			/>
		</PageWrap>
	);
}

export function SettingsPageSkeleton({
	tab,
	onTabChange,
}: {
	tab: SettingsTab;
	onTabChange: (next: SettingsTab) => void;
}) {
	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={Settings}
				title={PAGE_HEADERS.settings.title}
				description={PAGE_HEADERS.settings.description}
				afterHeader={
					<SettingsToolbar
						tab={tab}
						onTabChange={onTabChange}
						actions={
							<div inert>
								<SettingsReset onReset={async () => {}} />
							</div>
						}
					/>
				}
			/>
			<SettingsCardsSkeleton tab={tab} />
		</PageWrap>
	);
}
