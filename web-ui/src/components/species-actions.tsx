import { ExternalLink } from "lucide-react";

import { RecordingButton } from "~/components/recording-button.tsx";
import { Button } from "~/components/ui/button.tsx";
import type { SpeciesLink } from "~/lib/species-link.ts";

type SpeciesActionsProps = {
	audioUrl?: string | null;
	speciesLink: SpeciesLink | null;
	comName: string;
	/** `compact` for the Birds grid's cards (SPECIES_ACTION_BUTTON); `default`
	    is the 32px of the page's other action buttons, for a bird's own page. */
	size?: "compact" | "default";
};

/**
 * The pair's size: the compact 24px buttons where a pointer aims at them, and
 * below `sm` -- a phone -- the 30px `sm` size, an easier tap. Exported for the
 * skeletons that stand in for these buttons.
 */
export const SPECIES_ACTION_BUTTON = {
	size: "xs",
	className:
		"max-sm:h-[30px] max-sm:px-3 max-sm:text-xs max-sm:[&_svg:not([class*='size-'])]:size-3.5",
} as const;

function SpeciesActions({
	audioUrl,
	speciesLink,
	comName,
	size = "compact",
}: SpeciesActionsProps) {
	const sizing =
		size === "compact" ? SPECIES_ACTION_BUTTON : { size: "default" as const };
	return (
		<div
			className={
				audioUrl !== undefined
					? "relative z-10 flex w-full flex-wrap items-center justify-start gap-2"
					: "relative z-10 flex flex-wrap items-center gap-2"
			}
		>
			{audioUrl !== undefined && (
				<RecordingButton
					audioUrl={audioUrl}
					speciesName={comName}
					variant="default"
					{...sizing}
				/>
			)}
			{/* eBird for birds, iNaturalist for the frogs, insects and mammals;
			    sound classes like Dog or Engine have no page, so no button. */}
			{speciesLink && (
				<Button variant="outline" {...sizing} icon={ExternalLink} asChild>
					<a
						href={speciesLink.href}
						target="_blank"
						rel="noreferrer"
						aria-label={`${comName} on ${speciesLink.site}`}
					>
						{speciesLink.site}
					</a>
				</Button>
			)}
		</div>
	);
}

export { SpeciesActions };
