import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
	HealthPage,
	HealthPageSkeleton,
} from "~/components/health/health-page.tsx";
import { stationHealthQuery } from "~/lib/health.ts";
import { pageHead } from "~/lib/link-preview.ts";
import {
	FORM_QUERY,
	prefetchInBrowser,
	refreshAllData,
} from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSettingsPage,
	restartStationFn,
	saveStationSettingsFn,
	saveUpdateSettingsFn,
} from "~/lib/settings.ts";
import { powerStationFn } from "~/lib/station-power.ts";
import {
	checkForUpdatesFn,
	installUpdateFn,
	updateStateQuery,
} from "~/lib/updates.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

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

const stationSettingsQuery = queryOptions({
	...FORM_QUERY,
	queryKey: ["health-station-settings"],
	queryFn: async () => {
		const page = await getSettingsPage();
		return {
			values: page.station,
			timezones: page.supportedTimezones,
			automaticUpdates: page.updates.automatic,
		};
	},
});

export const Route = createFileRoute("/health")({
	head: () => pageHead("Health"),
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	loader: ({ context }) => {
		prefetchInBrowser(context.queryClient, healthQuery);
		prefetchInBrowser(context.queryClient, polledUpdateStateQuery);
		prefetchInBrowser(context.queryClient, stationSettingsQuery);
	},
	component: HealthRoute,
});

function HealthRoute() {
	const health = useSkeletonMinimum(useQuery(healthQuery).data);
	const { data: updates } = useQuery(polledUpdateStateQuery);
	const { data: station } = useQuery(stationSettingsQuery);
	const queryClient = useQueryClient();
	const router = useRouter();
	const restart = useServerFn(restartStationFn);
	const power = useServerFn(powerStationFn);
	const saveStation = useServerFn(saveStationSettingsFn);
	const saveUpdates = useServerFn(saveUpdateSettingsFn);
	const checkForUpdates = useServerFn(checkForUpdatesFn);
	const installUpdate = useServerFn(installUpdateFn);

	if (!health) return <HealthPageSkeleton />;

	return (
		<HealthPage
			health={health}
			updates={updates ?? null}
			handlers={{
				onRestartBirdnet: async () => {
					const result = await restart({ data: {} });
					await queryClient.invalidateQueries({
						queryKey: stationHealthQuery.queryKey,
					});
					return result;
				},
				onPower: (action) => power({ data: { action } }),
				onCheckUpdates: async () => {
					const state = await checkForUpdates();
					const { queryKey } = updateStateQuery;
					await queryClient.cancelQueries({ queryKey });
					queryClient.setQueryData(queryKey, state);
					return state;
				},
				onInstallUpdate: () => installUpdate(),
				automaticUpdates: station
					? {
							automatic: station.automaticUpdates,
							save: async (automatic) => {
								const result = await saveUpdates({ data: { automatic } });
								await queryClient.invalidateQueries({
									queryKey: stationSettingsQuery.queryKey,
								});
								return result;
							},
						}
					: null,
				station: station
					? {
							values: station.values,
							timezones: station.timezones,
							save: async (values) => {
								const result = await saveStation({ data: values });
								await refreshAllData(router, queryClient);
								return result;
							},
						}
					: null,
			}}
		/>
	);
}
