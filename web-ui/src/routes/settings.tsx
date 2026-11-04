import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	SettingsPage,
	SettingsPageSkeleton,
} from "~/components/settings/settings-page.tsx";
import { getStationHealth } from "~/lib/health.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSettingsPage,
	resetSettingsFn,
	restartStationFn,
	saveAudioSettingsFn,
	saveDetectionSettingsFn,
	saveHighlightSettingsFn,
	savePrivacySettingsFn,
	saveRecordingSettingsFn,
	saveReviewSettingsFn,
	saveStationSettingsFn,
	saveStorageSettingsFn,
	saveUpdateSettingsFn,
} from "~/lib/settings.ts";
import {
	checkForUpdatesFn,
	getUpdateState,
	installUpdateFn,
} from "~/lib/updates.ts";
import { usePolledData } from "~/lib/use-polled-data.ts";
import { useSettled } from "~/lib/use-settled.ts";

const HEALTH_INTERVAL_MS = 30_000;

const UPDATES_INTERVAL_MS = 5_000;

export const Route = createFileRoute("/settings")({
	head: () => ({ meta: [{ title: pageTitle("Settings") }] }),
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	loader: () => ({
		data: getSettingsPage(),
		health: getStationHealth(),
		updates: getUpdateState(),
	}),
	component: SettingsRoute,
});

function SettingsRoute() {
	const loaded = Route.useLoaderData();
	const settled = useSettled(loaded.data);
	const { data: health } = usePolledData(
		getStationHealth,
		loaded.health,
		HEALTH_INTERVAL_MS,
	);
	const saveStation = useServerFn(saveStationSettingsFn);
	const saveDetection = useServerFn(saveDetectionSettingsFn);
	const savePrivacy = useServerFn(savePrivacySettingsFn);
	const saveAudio = useServerFn(saveAudioSettingsFn);
	const saveRecording = useServerFn(saveRecordingSettingsFn);
	const saveStorage = useServerFn(saveStorageSettingsFn);
	const saveReview = useServerFn(saveReviewSettingsFn);
	const saveHighlights = useServerFn(saveHighlightSettingsFn);
	const saveUpdates = useServerFn(saveUpdateSettingsFn);
	const checkForUpdates = useServerFn(checkForUpdatesFn);
	const installUpdate = useServerFn(installUpdateFn);
	const { data: updates, replace: replaceUpdates } = usePolledData(
		getUpdateState,
		loaded.updates,
		UPDATES_INTERVAL_MS,
	);
	const reset = useServerFn(resetSettingsFn);
	const restart = useServerFn(restartStationFn);
	const router = useRouter();

	if (!settled) return <SettingsPageSkeleton />;

	return (
		<SettingsPage
			data={settled.value}
			health={health ?? undefined}
			onRestart={(card) => restart({ data: { card } })}
			updates={updates}
			onCheckUpdates={async () => {
				const state = await checkForUpdates();
				replaceUpdates(state);
				return state;
			}}
			onInstallUpdate={() => installUpdate()}
			onReset={async () => {
				const result = await reset({});
				await router.invalidate();
				await router.state.matches.find((match) => match.routeId === Route.id)
					?.loaderData?.data;
				return {
					message: result.message,
					needsRestart: result.status !== "reset",
				};
			}}
			savers={{
				station: (values) => saveStation({ data: values }),
				detection: (values) => saveDetection({ data: values }),
				privacy: (values) => savePrivacy({ data: values }),
				audio: (values) => saveAudio({ data: values }),
				recording: (values) => saveRecording({ data: values }),
				storage: (values) => saveStorage({ data: values }),
				review: (values) => saveReview({ data: values }),
				highlights: (values) => saveHighlights({ data: values }),
				updates: (values) => saveUpdates({ data: values }),
			}}
		/>
	);
}
