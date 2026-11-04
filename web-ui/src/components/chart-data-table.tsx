export function ChartDataTable({
	caption,
	bucketHeading,
	rows,
}: {
	caption: string;
	bucketHeading: string;
	rows: { label: string; count: number }[];
}) {
	return (
		<table className="sr-only">
			<caption>{caption}</caption>
			<thead>
				<tr>
					<th scope="col">{bucketHeading}</th>
					<th scope="col">Detections</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.label}>
						<th scope="row">{row.label}</th>
						<td>{row.count.toLocaleString()}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
