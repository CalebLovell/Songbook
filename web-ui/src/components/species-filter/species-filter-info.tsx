import { InfoTip } from "~/components/ui/info-tip.tsx";

export function SpeciesStatusInfo() {
	return (
		<InfoTip label="Species statuses">
			<ul className="space-y-1">
				<li>
					<strong>Automatic:</strong> detected when it's likely at this location
					and time of year.
				</li>
				<li>
					<strong>Custom:</strong> once any species is Custom, <em>only</em>{" "}
					Custom species are detected, and everything else is ignored.
					Always-detect species are added to that list automatically.
				</li>
				<li>
					<strong>Always detect:</strong> detected all year, even where it's
					normally unlikely.
				</li>
				<li>
					<strong>Never detect:</strong> never recorded.
				</li>
			</ul>
		</InfoTip>
	);
}

export function SpeciesFilterInfo() {
	return (
		<InfoTip
			label="Species Filter"
			size="default"
			className="me-0 pointer-coarse:size-9 size-8.5 border-input bg-card min-[400px]:me-0"
		>
			<p>
				BirdNET's model knows thousands of species worldwide. To avoid unlikely
				matches, each species is checked against the station's location and the
				time of year, and only species likely to be around are kept. That check
				is the <strong>Automatic</strong> status. The other statuses change how
				it applies to one species.
			</p>
			<p>
				<strong>Export</strong> saves the Custom, Always detect and Never detect
				lists as one file, which works with BirdNET-Pi's own lists.{" "}
				<strong>Import</strong> replaces all three lists with the ones in a
				file. <strong>Reset</strong> empties all three, so every species goes
				back to Automatic.
			</p>
		</InfoTip>
	);
}

export function UnmatchedEntriesInfo() {
	return (
		<InfoTip label="Unmatched list entries" size="default">
			<p>
				Names in the species lists that the installed model doesn't recognise.
				They're usually left over from an older model, or come from a typo in a
				list that was imported or edited by hand. Removing them has no effect on
				detection.
			</p>
		</InfoTip>
	);
}
