import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	stripSearchParams,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	DEFAULT_SETTINGS_TAB,
	SETTINGS_TABS,
	type SettingsTab,
} from "~/components/settings/settings-index.ts";
import {
	SettingsPage,
	SettingsPageSkeleton,
} from "~/components/settings/settings-page.tsx";
import { stationHealthQuery } from "~/lib/health.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { prefetchInBrowser } from "~/lib/query-client.ts";
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
	installUpdateFn,
	updateStateQuery,
} from "~/lib/updates.ts";
import { useSettled } from "~/lib/use-settled.ts";

const HEALTH_INTERVAL_MS = 30_000;

const UPDATES_INTERVAL_MS = 5_000;

const healthQuery = queryOptions({
	...stationHealthQuery,
	refetchInterval: HEALTH_INTERVAL_MS,
});

const polledUpdateStateQuery = queryOptions({
	...updateStateQuery,
	refetchInterval: UPDATES_INTERVAL_MS,
});

const settingsSearchSchema = z.object({
	tab: z
		.enum(SETTINGS_TABS)
		.default(DEFAULT_SETTINGS_TAB)
		.catch(DEFAULT_SETTINGS_TAB),
});

export const Route = createFileRoute("/settings")({
	head: () => pageHead("Settings"),
	validateSearch: settingsSearchSchema,
	search: {
		middlewares: [stripSearchParams({ tab: DEFAULT_SETTINGS_TAB })],
	},
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	loader: ({ context }) => {
		prefetchInBrowser(context.queryClient, healthQuery);
		prefetchInBrowser(context.queryClient, polledUpdateStateQuery);
		return { data: getSettingsPage() };
	},
	component: SettingsRoute,
});

function SettingsRoute() {
	const loaded = Route.useLoaderData();
	const settled = useSettled(loaded.data);
	const queryClient = useQueryClient();
	const { data: health } = useQuery(healthQuery);
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
	const { data: updates } = useQuery(polledUpdateStateQuery);
	const reset = useServerFn(resetSettingsFn);
	const restart = useServerFn(restartStationFn);
	const router = useRouter();
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	const showTab = (next: SettingsTab) =>
		navigate({
			search: { tab: next },
			replace: true,
			resetScroll: false,
		});
	const refreshingHealth = async <T,>(work: Promise<T>) => {
		const result = await work;
		await queryClient.invalidateQueries({ queryKey: healthQuery.queryKey });
		return result;
	};

	if (!settled) return <SettingsPageSkeleton tab={tab} onTabChange={showTab} />;

	return (
		<SettingsPage
			tab={tab}
			onTabChange={showTab}
			data={settled.value}
			health={health}
			onRestart={(card) => refreshingHealth(restart({ data: { card } }))}
			updates={updates ?? null}
			onCheckUpdates={async () => {
				const state = await checkForUpdates();
				const { queryKey } = updateStateQuery;
				await queryClient.cancelQueries({ queryKey });
				queryClient.setQueryData(queryKey, state);
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
				station: (values) => refreshingHealth(saveStation({ data: values })),
				detection: (values) => saveDetection({ data: values }),
				privacy: (values) => savePrivacy({ data: values }),
				audio: (values) => refreshingHealth(saveAudio({ data: values })),
				recording: (values) =>
					refreshingHealth(saveRecording({ data: values })),
				storage: (values) => refreshingHealth(saveStorage({ data: values })),
				review: (values) => saveReview({ data: values }),
				highlights: (values) => saveHighlights({ data: values }),
				updates: (values) => saveUpdates({ data: values }),
			}}
		/>
	);
}
