import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
	SettingsPage,
	SettingsPageSkeleton,
} from "~/components/settings/settings-page.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { FORM_QUERY, refreshAllData } from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSettingsPage,
	resetPreferencesFn,
	savePreferencesFn,
} from "~/lib/settings.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const settingsQuery = queryOptions({
	...FORM_QUERY,
	queryKey: ["settings-page"],
	queryFn: async () => {
		const { artwork, playback, highlights } = await getSettingsPage();
		return { artwork, playback, highlights };
	},
});

export const Route = createFileRoute("/settings")({
	head: () => pageHead("Settings"),
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	component: SettingsRoute,
});

function SettingsRoute() {
	const initial = useSkeletonMinimum(useQuery(settingsQuery).data);
	const queryClient = useQueryClient();
	const router = useRouter();
	const save = useServerFn(savePreferencesFn);
	const reset = useServerFn(resetPreferencesFn);

	const refreshingEverything = async <T,>(work: Promise<T>) => {
		const result = await work;
		forgetUnlockStatus();
		await refreshAllData(router, queryClient);
		return result;
	};

	if (!initial) return <SettingsPageSkeleton />;

	return (
		<SettingsPage
			initial={initial}
			actions={{
				save: (values) => refreshingEverything(save({ data: values })),
				reset: () => refreshingEverything(reset()),
			}}
		/>
	);
}
