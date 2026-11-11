import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	redirect,
	stripSearchParams,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DataCards } from "~/components/settings/data-cards.tsx";
import {
	DEFAULT_SETTINGS_TAB,
	SETTINGS_TABS,
	type SettingsTab,
} from "~/components/settings/settings-index.ts";
import {
	SettingsPage,
	SettingsPageSkeleton,
} from "~/components/settings/settings-page.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { FORM_QUERY, refreshAllData } from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSettingsPage,
	resetSettingsFn,
	restartStationFn,
	saveArtworkSettingsFn,
	saveAudioSettingsFn,
	saveDetectionSettingsFn,
	saveHighlightSettingsFn,
	saveRecordingSettingsFn,
	saveReviewSettingsFn,
	saveStorageSettingsFn,
} from "~/lib/settings.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const settingsPageQuery = queryOptions({
	...FORM_QUERY,
	queryKey: ["settings-page"],
	queryFn: () => getSettingsPage(),
});

const MOVED_TO_HEALTH = "updates";

const settingsSearchSchema = z.object({
	tab: z
		.enum([...SETTINGS_TABS, MOVED_TO_HEALTH])
		.default(DEFAULT_SETTINGS_TAB)
		.catch(DEFAULT_SETTINGS_TAB),
});

export const Route = createFileRoute("/settings")({
	head: () => pageHead("Settings"),
	validateSearch: settingsSearchSchema,
	search: {
		middlewares: [stripSearchParams({ tab: DEFAULT_SETTINGS_TAB })],
	},
	beforeLoad: ({ context, location, search }) => {
		requireUnlocked(context.auth, location);
		if (search.tab === MOVED_TO_HEALTH)
			throw redirect({ to: "/health", replace: true });
	},
	component: SettingsRoute,
});

function SettingsRoute() {
	const page = useSkeletonMinimum(useQuery(settingsPageQuery).data);
	const queryClient = useQueryClient();
	const saveDetection = useServerFn(saveDetectionSettingsFn);
	const saveAudio = useServerFn(saveAudioSettingsFn);
	const saveRecording = useServerFn(saveRecordingSettingsFn);
	const saveStorage = useServerFn(saveStorageSettingsFn);
	const saveReview = useServerFn(saveReviewSettingsFn);
	const saveHighlights = useServerFn(saveHighlightSettingsFn);
	const saveArtwork = useServerFn(saveArtworkSettingsFn);
	const reset = useServerFn(resetSettingsFn);
	const restart = useServerFn(restartStationFn);
	const router = useRouter();
	const { tab: requested } = Route.useSearch();
	const tab = requested === MOVED_TO_HEALTH ? DEFAULT_SETTINGS_TAB : requested;
	const navigate = Route.useNavigate();
	const showTab = (next: SettingsTab) =>
		navigate({
			search: { tab: next },
			replace: true,
			resetScroll: false,
		});
	const refreshingData = async <T,>(work: Promise<T>) => {
		const result = await work;
		await queryClient.invalidateQueries();
		return result;
	};

	const dataTab = <DataCards active={tab === "data"} />;

	if (!page)
		return (
			<SettingsPageSkeleton tab={tab} onTabChange={showTab} dataTab={dataTab} />
		);

	return (
		<SettingsPage
			tab={tab}
			onTabChange={showTab}
			data={page}
			dataTab={dataTab}
			onRestart={(card) => refreshingData(restart({ data: { card } }))}
			onReset={async () => {
				const result = await reset({});
				await refreshAllData(router, queryClient);
				return {
					message: result.message,
					needsRestart: result.status !== "reset",
				};
			}}
			savers={{
				detection: (values) => refreshingData(saveDetection({ data: values })),
				audio: (values) => refreshingData(saveAudio({ data: values })),
				recording: (values) => refreshingData(saveRecording({ data: values })),
				storage: (values) => refreshingData(saveStorage({ data: values })),
				review: (values) => refreshingData(saveReview({ data: values })),
				highlights: (values) =>
					refreshingData(saveHighlights({ data: values })),
				artwork: async (values) => {
					const result = await saveArtwork({ data: values });
					forgetUnlockStatus();
					await refreshAllData(router, queryClient);
					return result;
				},
			}}
		/>
	);
}
