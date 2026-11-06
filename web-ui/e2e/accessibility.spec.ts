import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { DEV_PASSWORD } from "../src/lib/dev-password.ts";

const PASSWORD = process.env.SMOKE_PASSWORD ?? DEV_PASSWORD;
const PUBLIC_PAGES = [
	"/live",
	"/timeline",
	"/detections",
	"/birds",
	"/learn",
	"/account",
	"/no-such-page",
];
const GATED_PAGES = ["/review", "/settings", "/species-control"];

async function settle(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
}

async function signIn(page: Page) {
	await settle(page, "/account");
	await page.getByLabel("Station password").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await expect(page.getByLabel("Station password")).toHaveCount(0);
}

async function birdProfilePath(page: Page) {
	await settle(page, "/birds");
	const href = await page
		.locator('main a[href^="/birds/"]')
		.first()
		.getAttribute("href");
	return href ?? "/birds";
}

async function expectNoAxeViolations(page: Page, path: string) {
	await settle(page, path);
	const { violations } = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.exclude("[data-year-grid]")
		.analyze();
	expect(
		violations.map(({ id, nodes }) => `${id}: ${nodes[0]?.target}`),
		path,
	).toEqual([]);
}

const focusIsOnBody = (page: Page) =>
	page.evaluate(() => document.activeElement === document.body);

test.describe("axe", () => {
	for (const path of PUBLIC_PAGES) {
		test(`${path} has no violations`, async ({ page }) => {
			await expectNoAxeViolations(page, path);
		});
	}

	test("a bird profile has no violations", async ({ page }) => {
		await expectNoAxeViolations(page, await birdProfilePath(page));
	});

	test("gated pages have no violations", async ({ page }) => {
		await signIn(page);
		for (const path of GATED_PAGES) await expectNoAxeViolations(page, path);
	});
});

test.describe("page navigation", () => {
	test("the first Tab offers a skip link that lands on the content", async ({
		page,
	}) => {
		await settle(page, "/birds");
		await page.keyboard.press("Tab");
		const skip = page.getByRole("link", { name: "Skip to main content" });
		await expect(skip).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator("main")).toBeFocused();
	});

	test("changing page moves focus to the content and announces it", async ({
		page,
	}) => {
		await settle(page, "/live");
		await page.locator('nav a[href^="/birds"]').first().focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/birds/);
		await expect(page.locator("main")).toBeFocused();
		await expect(page.locator("#live-announcer")).toContainText("All Birds");
	});

	test("scroll keys work before anything has focus", async ({ page }) => {
		await settle(page, "/birds");
		await page.keyboard.press("PageDown");
		await expect
			.poll(() =>
				page.evaluate(() => document.querySelector("main")?.scrollTop ?? 0),
			)
			.toBeGreaterThan(0);
	});

	test("an unknown address says so in its title", async ({ page }) => {
		await settle(page, "/no-such-page");
		await expect(page).toHaveTitle(/Page not found/);
	});
});

test.describe("confirmation dialogs", () => {
	test("hold focus, then give it back", async ({ page }) => {
		await signIn(page);
		await settle(page, "/settings");
		const opener = page.getByRole("button", { name: /factory defaults/i });
		await opener.focus();
		await page.keyboard.press("Enter");

		const dialog = page.getByRole("alertdialog");
		await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
		for (let press = 0; press < 6; press++) {
			await page.keyboard.press("Tab");
			await expect(dialog.locator(":focus")).toHaveCount(1);
		}

		await page.keyboard.press("Escape");
		await expect(dialog).toHaveCount(0);
		await expect(opener).toBeFocused();
	});
});

test.describe("mobile menu", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("holds focus, then gives it back", async ({ page }) => {
		await settle(page, "/live");
		const opener = page.getByRole("button", { name: "Open navigation" });
		await opener.focus();
		await page.keyboard.press("Enter");

		const menu = page.getByRole("dialog", { name: "Navigation" });
		await expect(
			menu.getByRole("button", { name: "Close navigation" }),
		).toBeFocused();
		await expect(page.locator("[inert] main")).toHaveCount(1);

		await page.keyboard.press("Escape");
		await expect(opener).toBeFocused();
		await expect(page.locator("[inert] main")).toHaveCount(0);
	});
});

test.describe("Learn quiz", () => {
	const choices = (page: Page) =>
		page.locator("main fieldset").nth(1).locator("button");
	const nextControl = (page: Page) =>
		page.locator("main").getByRole("button", {
			name: /Next bird|See your score/,
		});
	const isOpen = async (page: Page, index: number) =>
		(await choices(page).nth(index).getAttribute("aria-disabled")) !== "true";

	async function solve(page: Page) {
		const total = await choices(page).count();
		for (let index = 0; index < total; index++) {
			if (await isOpen(page, index)) {
				await choices(page).nth(index).focus();
				await page.keyboard.press("Enter");
			}
			if (await nextControl(page).isEnabled()) return;
		}
	}

	test("typing a digit in the site search does not guess", async ({ page }) => {
		await settle(page, "/learn");
		await page.getByRole("combobox", { name: "Search the station" }).focus();
		await page.keyboard.type("1");
		expect(await isOpen(page, 0)).toBe(true);
	});

	test("Enter on another control does not skip the bird", async ({ page }) => {
		await settle(page, "/learn");
		await solve(page);
		await page.getByRole("button", { name: "About Bird quiz" }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(nextControl(page)).toBeEnabled();
	});

	test("a guess is announced and keeps focus", async ({ page }) => {
		await settle(page, "/learn");
		await choices(page).first().focus();
		await page.keyboard.press("Enter");
		await expect(page.locator("#live-announcer")).toContainText(
			/Correct|Not the/,
		);
		expect(await focusIsOnBody(page)).toBe(false);
	});

	test("focus follows the round to its score", async ({ page }) => {
		await settle(page, "/learn");
		for (;;) {
			await solve(page);
			await expect(nextControl(page)).toBeFocused();
			const label = await nextControl(page).textContent();
			await page.keyboard.press("Enter");
			if (label?.includes("score")) break;
			await expect(
				page.locator("main").getByRole("button", { name: "Play the call" }),
			).toBeFocused();
		}
		await expect(
			page.getByRole("heading", { name: "Round complete" }),
		).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Round results" }),
		).toBeFocused();
	});
});

test.describe("tables", () => {
	test("headers report the sort, and rows can be skipped", async ({ page }) => {
		await settle(page, "/detections");
		await expect(page.getByRole("table", { name: "Detections" })).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: "Recorded" }),
		).toHaveAttribute("aria-sort", /ascending|descending/);

		await page.getByRole("link", { name: "Skip to table actions" }).focus();
		await page.keyboard.press("Enter");
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("navigation", { name: "Detections pages" }).locator(":focus"),
		).toHaveCount(1);
	});

	test("ticking a row announces the count and Enter reaches the actions", async ({
		page,
	}) => {
		await signIn(page);
		await settle(page, "/detections");
		const box = page.locator("tbody input[type=checkbox]").first();
		await box.focus();
		await page.keyboard.press("Space");
		await expect(page.locator("#live-announcer")).toContainText("1 selected");
		await page.keyboard.press("Enter");
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("button", { name: "Clear selection" }),
		).toBeFocused();
	});
});

test.describe("focus visibility", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("narrow sort menu and list tools show the ring", async ({ page }) => {
		await signIn(page);
		await settle(page, "/species-control");
		await page.keyboard.press("Tab");
		for (const control of [
			page.getByRole("combobox", { name: "Sort species by" }),
			page.getByRole("button", { name: "Import lists", exact: true }),
		]) {
			await control.focus();
			await expect(control).toHaveCSS("outline-style", "solid");
		}
	});
});

test.describe("year grid", () => {
	test("is one tab stop, walked with arrow keys", async ({ page }) => {
		await settle(page, await birdProfilePath(page));
		const grid = page.locator("[data-year-grid]");
		await expect(grid.locator('a[tabindex="0"]')).toHaveCount(1);
		await grid.locator('a[tabindex="0"]').focus();
		const before = await page.evaluate(() =>
			document.activeElement?.getAttribute("href"),
		);
		await page.keyboard.press("Home");
		const first = await page.evaluate(() =>
			document.activeElement?.getAttribute("href"),
		);
		await page.keyboard.press("End");
		const last = await page.evaluate(() =>
			document.activeElement?.getAttribute("href"),
		);
		expect(first).not.toEqual(last);
		expect(before).toBeTruthy();
		await expect(grid.locator('a[aria-label*=": 0 detections"]')).toHaveCount(0);
	});
});

test.describe("reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("stops looping and entrance animation", async ({ page }) => {
		await settle(page, "/live");
		const durations = await page.evaluate(() =>
			["animate-live-pulse", "animate-rise-in", "animate-spin"].map((name) => {
				const probe = document.createElement("div");
				probe.className = name;
				document.body.append(probe);
				const seconds = Number.parseFloat(
					getComputedStyle(probe).animationDuration,
				);
				probe.remove();
				return seconds;
			}),
		);
		for (const seconds of durations) expect(seconds).toBeLessThan(0.01);
	});
});

test.describe("heat map", () => {
	test("gives screen readers a table of species by hour", async ({ page }) => {
		await settle(page, "/timeline");
		const table = page.getByRole("table", { name: /Species by hour/ });
		await expect(table).toHaveCount(1);
		await expect(table.getByRole("columnheader").first()).toHaveText("Species");
		await expect(page.locator('main [role="img"][aria-label*="—"]')).toHaveCount(
			0,
		);
	});
});
