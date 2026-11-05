import { Settings } from "lucide-react";
import { useState } from "react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import type { StationHealth } from "~/lib/health-data.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import type { SettingsPageData } from "~/lib/settings-data.ts";
import type { UpdateState } from "~/lib/updates-data.ts";
import { RestartButton } from "./restart-button.tsx";
import {
	SettingsCards,
	SettingsCardsSkeleton,
	type SettingsRestarter,
	type SettingsSavers,
} from "./settings-cards.tsx";
import { SettingsReset } from "./settings-reset.tsx";

type ResetOutcome = { message: string; needsRestart: boolean };

export function SettingsPage({
	data,
	savers = {},
	onReset,
	onRestart,
	health,
	updates,
	onCheckUpdates,
	onInstallUpdate,
}: {
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

	const loadedValues = JSON.stringify([
		data.station,
		data.detection,
		data.privacy,
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
				action={
					onReset ? (
						<div className="flex flex-wrap items-center justify-end gap-2">
							{needsRestart && onRestart ? (
								<RestartButton
									onRestart={async () => {
										const toastId = "settings-reset";
										toast.loading("Restarting BirdNET…", { id: toastId });
										try {
											const result = await onRestart(undefined);
											setNeedsRestart(false);
											toast.success(result.message, { id: toastId });
										} catch (error) {
											toast.warning(
												error instanceof Error
													? error.message
													: "BirdNET could not be restarted.",
												{ id: toastId, duration: 10_000 },
											);
										}
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
										destructiveToast(outcome.message, { id: "settings-reset" });
									}
								}}
							/>
						</div>
					) : undefined
				}
			/>
			<SettingsCards
				key={loadedValues}
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

export function SettingsPageSkeleton() {
	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={Settings}
				title={PAGE_HEADERS.settings.title}
				description={PAGE_HEADERS.settings.description}
				action={
					<div inert className="flex flex-wrap items-center justify-end gap-2">
						<SettingsReset onReset={async () => {}} />
					</div>
				}
			/>
			<SettingsCardsSkeleton />
		</PageWrap>
	);
}
