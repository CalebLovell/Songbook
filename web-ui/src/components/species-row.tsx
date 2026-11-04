import { SpeciesImage } from "~/components/species-image.tsx";

export const LIST_ROW =
	"flex min-h-18 items-center gap-3 rounded-md px-3 py-2 odd:bg-[var(--meadow)] max-[400px]:gap-2 max-[400px]:px-2";

export function SpeciesThumbnail({
	imageUrl,
	comName,
}: {
	imageUrl: string | null;
	comName: string;
}) {
	return (
		<div className="flex size-10 shrink-0 items-center justify-center overflow-hidden">
			<SpeciesImage
				imageUrl={imageUrl}
				alt=""
				title={comName}
				glyphClassName="size-5"
			/>
		</div>
	);
}
