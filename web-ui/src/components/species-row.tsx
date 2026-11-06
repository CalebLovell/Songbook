import { SpeciesImage } from "~/components/species-image.tsx";

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
