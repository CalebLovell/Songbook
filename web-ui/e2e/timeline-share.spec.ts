import { expect, type Page, test } from "@playwright/test";

/**
 * The Timeline's Share button opens the summary image for the window on screen,
 * whatever the period and window were changed to just before. It once got built
 * before that window's figures had arrived, and showed the wrong window.
 *
 * Needs a seeded station (`npm run db:reset`).
 */

const PERIODS = ["Weekly", "Monthly", "Yearly", "Daily", "Weekly"] as const;

/**
 * The species figure in the body card's kicker, once the window has loaded.
 * An empty window drops the figures for a "No detections recorded" card.
 */
async function speciesOnScreen(page: Page): Promise<number> {
	const figure = page
		.locator("span.whitespace-nowrap", { hasText: /species$/ })
		.locator('[data-slot="count"]');
	const empty = page.getByText("No detections recorded").first();
	await expect(figure.or(empty)).toBeVisible();
	if (await empty.isVisible()) return 0;
	return Number((await figure.innerText()).replace(/,/g, ""));
}

const shareButton = (page: Page) => page.getByRole("button", { name: "Share" });
const shareDialog = (page: Page) =>
	page.getByRole("dialog", { name: "Share Summary" });
const shownImage = (page: Page) =>
	shareDialog(page).getByRole("img").and(page.locator(":visible"));

async function changeWindow(page: Page, action: () => Promise<void>) {
	const heading = page.getByRole("heading", { level: 1 });
	const before = await heading.innerText();
	await action();
	await expect(heading).not.toHaveText(before);
}

async function expectShareMatchesPage(page: Page): Promise<string | null> {
	const species = await speciesOnScreen(page);
	if (species === 0) {
		await expect(shareButton(page)).toBeDisabled();
		return null;
	}
	const title = await page.getByRole("heading", { level: 1 }).innerText();

	await shareButton(page).click();
	const alt = (await shownImage(page).getAttribute("alt")) ?? "";
	expect(alt, "names its window").toContain(`${title}. `);
	expect(alt).toContain(`Species ${species.toLocaleString()}`);
	await expect(
		shareDialog(page).getByRole("button", { name: "Download" }),
	).toBeEnabled();

	await page.keyboard.press("Escape");
	await expect(shareDialog(page)).toBeHidden();
	return alt;
}

test("a data refresh leaves the open dialog and its image in place", async ({
	page,
}) => {
	await page.goto("/timeline?period=week");
	await page.waitForLoadState("networkidle");
	test.skip(
		(await shareButton(page).count()) === 0,
		"station has no detections yet",
	);

	await shareButton(page).click();
	await expect(shownImage(page)).toBeVisible();
	const before = await shownImage(page).getAttribute("src");

	await page.evaluate(async () => {
		const { __TSR_ROUTER__: router } = window as unknown as {
			__TSR_ROUTER__: { invalidate: () => Promise<void> };
		};
		await router.invalidate();
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	});

	await expect(shownImage(page)).toHaveAttribute("src", before ?? "");
});

test("Top Birds comes first and Highlights is its own image", async ({
	page,
}) => {
	await page.goto("/timeline?period=month");
	await page.waitForLoadState("networkidle");
	test.skip(
		(await shareButton(page).count()) === 0,
		"station has no detections yet",
	);

	await shareButton(page).click();
	await expect(shownImage(page)).toBeVisible();
	const choices = shareDialog(page).getByRole("radio");
	test.skip((await choices.count()) === 0, "window has no highlights");

	await expect(choices).toHaveText(["Top Birds", "Highlights"]);
	await expect(choices.first()).toBeChecked();
	const topBirds = await shownImage(page).getAttribute("src");
	await choices.last().click();
	await expect(shownImage(page)).not.toHaveAttribute("src", topBirds ?? "");
	await choices.first().click();
	await expect(shownImage(page)).toHaveAttribute("src", topBirds ?? "");
});

test("the shared image follows every period and window change", async ({
	page,
}) => {
	await page.goto("/timeline?period=day");
	await page.waitForLoadState("networkidle");
	test.skip(
		(await shareButton(page).count()) === 0,
		"station has no detections yet",
	);

	await expectShareMatchesPage(page);

	let shared: string | null = null;
	for (const period of PERIODS) {
		await changeWindow(page, () =>
			page.getByRole("radio", { name: period, exact: true }).click(),
		);
		shared = await expectShareMatchesPage(page);
	}

	// Paging within a period, not just switching between them.
	for (const direction of ["Previous", "Next"]) {
		const arrow = page.getByRole("button", {
			name: new RegExp(`^${direction}`),
		});
		if (!(await arrow.isEnabled())) continue;
		await changeWindow(page, () => arrow.click());
		const paged = await expectShareMatchesPage(page);
		expect(paged, `${direction} moves the window`).not.toEqual(shared);
		shared = paged;
	}
});
