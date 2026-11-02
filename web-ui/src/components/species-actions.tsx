import { ExternalLink } from "lucide-react";

import { RecordingButton } from "~/components/recording-button.tsx";
import { Button } from "~/components/ui/button.tsx";
import type { SpeciesLink } from "~/lib/species-link.ts";

type SpeciesActionsProps = {
	audioUrl?: string | null;
	speciesLink: SpeciesLink | null;
	comName: string;
};

/**
 * The pair's size: the compact 24px buttons where a pointer aims at them, and
 * below `sm` -- a phone -- the 28px `sm` size, an easier tap. Exported for the
 * skeletons that stand in for these buttons.
 */
export const SPECIES_ACTION_BUTTON = {
	size: "xs",
	className:
		"max-sm:h-7 max-sm:px-3 max-sm:text-xs max-sm:[&_svg:not([class*='size-'])]:size-3.5",
} as const;

function SpeciesActions({
	audioUrl,
	speciesLink,
	comName,
}: SpeciesActionsProps) {
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
					{...SPECIES_ACTION_BUTTON}
				/>
			)}
			{/* eBird for birds, iNaturalist for the frogs, insects and mammals;
			    sound classes like Dog or Engine have no page, so no button. */}
			{speciesLink && (
				<Button
					variant="outline"
					{...SPECIES_ACTION_BUTTON}
					icon={ExternalLink}
					asChild
				>
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
