import { Settings } from "lucide-react";

import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import type { PreferenceSettings } from "~/lib/settings-data.ts";
import {
	type SettingsActions,
	SettingsCard,
	SettingsCardSkeleton,
} from "./settings-card.tsx";

function SettingsHeader() {
	return (
		<PageHeaderCard
			icon={Settings}
			title={PAGE_HEADERS.settings.title}
			description={PAGE_HEADERS.settings.description}
		/>
	);
}

export function SettingsPage({
	initial,
	actions,
}: {
	initial: PreferenceSettings;
	actions: SettingsActions;
}) {
	return (
		<PageWrap className="space-y-page">
			<SettingsHeader />
			<SettingsCard initial={initial} actions={actions} />
		</PageWrap>
	);
}

export function SettingsPageSkeleton() {
	return (
		<PageWrap className="space-y-page">
			<SettingsHeader />
			<SettingsCardSkeleton />
		</PageWrap>
	);
}
