# Design system

Tokens live in `src/styles.css`; this file says what they mean and when to use
them. Each token is registered in `@theme`, so a class names it directly (`bg-meadow`,
`border-line`, `gap-page`) rather than through `bg-[var(--meadow)]`. New spacing
tokens also go in the `cn` merge config (`lib/utils.ts`), which otherwise keeps both
`gap-2` and `gap-page`. The visual reference is the "Songbook Design System" canvas
on claude.ai.

## Principles

- **Paper for content.** Content sits on `Card`s (`ui/card.tsx`: white, `--line`
  hairline, 4px radius, `p-page`) on the paper ground. Cards never nest: a figure row
  inside a card uses `PageHeaderStats inline`, not more cards.
- **The sidebar is an inset card** on desktop (`site-sidebar.tsx`), with paper
  around it. Page content fills the remaining width; no max-width column.
- **Show the bird.** Any list of species uses the species-row idiom:
  `SpeciesThumbnail` + `illustrationUrlFor(sciName)`, common name over an
  italic binomial, `odd:bg-meadow` zebra, no label→value rows. A
  species without a painting shows its reference photo
  (`reference-photos.ts`), square-cropped to fill the slot with the 4px
  radius, and no tag or tone. With no photo, or when the photo can't load, it
  shows the plain muted bird glyph (`SpeciesImage`), never initials or a
  tinted box.
- **One instrument.** Every figure is the same size, face and weight
  (`PageHeaderCard` stats: kicker label + 20px semibold tabular value).
  Where a row of figure cards gets too narrow, the whole row steps down to
  16px (and, narrowest, drops the icon) rather than truncating a value.
- **Stable under the cursor.** Fixed slots and floored line boxes, so data
  arriving never shifts a control.

## Color

Nine named colors: `--paper` `#fbfdf6`, `--paper-raised` `#fff`, `--meadow`
`#f8faf2`, `--sage` `#c5ccb6`, `--sand` `#c69a58`, `--clay` `#9c4a34`,
`--bark` `#472f1d`, `--moss` `#203b14`, `--ink` `#0a1d08`.

Everything else is a `color-mix(in oklab, …)` of those (black is also fair
game as a mix ingredient: secondary text is a neutral grey, so the page isn't
green all the way down). Use the named token
for a meaning; don't write a new mix inline when one exists:

| Token | Use |
| --- | --- |
| `--line` | every border and hairline (moss 15%) |
| `--track` | unfilled remainder of a bar (moss 28%) |
| `--hover-line` | border of a linked card on hover |
| `--focus-ring` | keyboard focus, 2px outline, 2px offset; drawn inset (`-outline-offset-2`) on a segment of a joined control, whose group clips outside it |
| `--muted-foreground` | secondary text (neutral grey, black 49%) |
| `--icon-well` | round background behind a card's leading icon |
| `--row-selected` | a selected row in a list or table |
| `--live-fill` | the Live pill |
| `--row-well` | the slack under a paged list's rows on a short page (`RowWell`) |
| `--confidence-high/mid/low` | confidence pills; text is moss / bark / ink |
| `--toast-{success,warning,error}-fill/-line` | toast tones; title is moss / bark / clay, neutral toasts stay white |

Confidence tiers are fixed at ≥90%, ≥75% and below (`lib/confidence.ts`),
never a gradient. Destructive is clay. Single-series charts are moss. Heat
shading is a continuous ramp from a pale moss wash to full moss, log-scaled,
with one scale per chart topped by its busiest cell across every row -- never
a row's own peak (`lib/heatmap.ts`). The ramp steps over the mixes where neither
digit colour reaches 4.5:1.

## Type

Georgia for everything: headings, body, controls, figures. Numbers use
`tabular-nums`. Monospace only for code and paths.

Dates are always "Sep 29, 2026" and, with a time, "Sep 29, 2026, 12:15 PM"
(`lib/date-format.ts`). Counts use thousands separators; a slot too small for
the full figure (a heat-map cell) shortens past three digits: 1k, 1.2k, 300k,
1m (`compactCount`).

- Page title: 20px bold
- Figure: 20px semibold, tabular
- Count: `Count` (`ui/count.tsx`), 13px bold ink, tabular. Every count of birds or
  detections in running UI (a species row's total, a "117 detections · 30
  species" readout) uses it. Headline stats stay Figures; numbers drawn inside
  a chart (heatmap cells, bar labels) and table cells keep their own sizes.
- Body 16px, secondary 14px, species binomial 14px italic
- Kicker: `Kicker` (`ui/kicker.tsx`), 11px, 700, uppercase, 0.16em tracking, moss
- Controls: 11–14px, weight 500

## Shape, spacing, motion

- Radius: 4px cards and buttons (`rounded-md`), 6px nav rows, 2px tooltips,
  pills fully round.
- Spacing: 16px is the unit for card padding, gaps between cards and the
  page gutter -- `--page-gap`, 8px under 400px. The same gap separates the
  controls in a toolbar or a row of buttons (search, menus, toggles,
  buttons), side by side or stacked; only a segmented control's own
  segments are joined.
- Motion: 180ms ease for color/border/lift; `animate-rise-in` 700ms on mount;
  `animate-flash-in` 2.4s sand highlight for new arrivals; charts 500ms.
  Only linked cards lift on hover. `prefers-reduced-motion` stops all of it
  (`styles.css`, `useReducedMotion` for charts).

## Components

- **Styling lives in the component.** A repeated look is a component with Tailwind
  classes in its own file, not a class in `styles.css`. That file holds tokens,
  `@theme`, base element rules, `@keyframes` and overrides of markup we don't own.
- **Links and buttons**: `@layer base` gives links their moss text and every link
  and button the 180ms motion, so a utility on one always wins. A link drawn as a
  button (`data-slot="button"`) takes its colours from the variant instead. Don't add
  `transition-*` to them; the base rule is the house motion.
- **Page wrapper**: every page sits in `PageWrap`. Its gutters and a card's padding
  use `--page-gap`, so all of them halve together under 400px.
- **Button** (`ui/button.tsx`): the default size is `xs` (24px). Pass glyphs
  via `icon`, never as children, so padding stays constant.
- **Control height**: the toolbar row under a page's header, the inputs,
  selects, toggles and joined controls that share its family (`h-8.5`), and the
  sidebar's nav rows stand 34px with a mouse. Everything else, such as plain
  buttons and pagers, stands 32px at most. On a touch screen (`pointer-coarse:`) the
  full-height controls step up to 36px for an easier tap; nothing is taller.
- **Toggle group**: on = moss fill, white text; segments share borders.
- **Input**: focus is shown by a `--focus-ring` border, not the outline. Fields and checkboxes keep the
  site's light borders even though they fall short of 3:1 (WCAG 1.4.11): a darker line was tried and looked wrong.
- **Nav rows**: active is marked by fill alone (a step deeper than the meadow
  hover), never bolder text. Gated pages stay listed with a lock icon.
- **Sidebar**: logo, then site search (species, pages, filtered detections;
  `/` to focus), then the nav (Explore, Manage, then an Account link to
  `/account`), with Settings and Species control at the foot. The Live pill lives in the Live page's hero, not the chrome.
- **Empty states**: `EmptyNote`. The bird page's Best recording card instead keeps
  its plot: `QuietSpectrogram`, a faint noise floor with a muted icon and the message
  centered, and no controls. It stays generic, never saying why a clip is missing.
- **Loading shells**: navigation is instant. Route loaders return their
  server calls as deferred promises (never `await` them), and each part that
  needs the data renders through `Deferred` (`components/deferred.tsx`) or
  `useSettled` -- state, not Suspense, so hydration can't strand a shell.
  Anything that doesn't depend on the data (titles, labels, controls driven
  by the URL) renders as itself at once. Every card that fetches has a
  `…Skeleton` beside it, built from the card's own markup and shared class
  constants so the two can't drift: `ShellText` for each line of text (an
  empty line in the real type, bar drawn over it), `ShellSized` around a real
  control for its exact box, `ShellFigure` (a small rectangle) for a figure
  in running text, and one plain rectangle for a chart. Loading and loaded
  must measure the same; only row counts that depend on the data may differ.
  No animation between the two: shells show from the first frame and content
  replaces them in place.
- **Keyboard**: every page opens with a skip link, and a page change moves focus to
  `main` (tabindex -1, never ringed) and speaks the title. A scroll key with nothing
  focused goes to `main`, the only scroller. Page-wide single-key shortcuts ignore
  anything typed into a field, and Enter never fires one over the focused control.
- **Chart tooltip**: one line, "6 AM — 1,284 detections", only the bucket bold.
  Pointer-only.
- **Charts**: hidden from assistive tech and not tab stops; `ChartDataTable`
  gives screen readers every value. Axes are zero-filled (always 24 hours, 12
  months). A `ResponsiveContainer` needs a `minHeight` floor or it can measure
  zero and draw nothing; count axes use `width="auto"` so five digits aren't
  clipped. One series, no legend. A ranked list's bars scale to its own leader.
- **Heat maps**: the timeline's has one line per species and 24 fixed 1.75rem
  columns that never shrink, stack or scroll. Names truncate to make room, and a
  card under 56rem drops the hours. A zero is an empty cell with no digit. The
  bird page's year grid scrolls inside its card on a phone, opens on today for
  the current year, and never draws a day still to come. Only days with detections
  are links; together they are one tab stop, walked in date order with the arrows.
  Their 12px squares miss the 24px target size, a known gap kept for the look. Hour bars on a species
  tile are the one exception to the shared heat scale: they compare a bird only
  with itself, as a linear share of its own peak.
- **Heat map text**: the timeline's hours are hidden from assistive tech, and a hidden
  table gives every species by hour at any width. A narrow card drops the hours for
  sighted users; that is a known gap against reflow, kept on purpose.
- **Tables** (Detections, Species Control): one grid with the header, body and
  rows as subgrids, so only the rows scroll and the columns still align. Header,
  rows and footer stand the same height. Width follows the card: under 36rem one
  sort menu replaces the headings and the binomial stacks under the common name,
  36rem and 54rem each bring columns back. On the narrowest screens (400px) the
  body scrolls sideways on its own, so the sort menu never leaves the screen. Only
  the selection column (2.5rem) and the last column are pinned; the rest share
  the width. Row numbers count on across pages (`IndexDot`). The footer is one
  line that keeps its height whatever is ticked: range on the left, stepper on the
  far right, and selection actions beside the range once something is ticked,
  never as dead buttons. Those actions stand as tall as the stepper, and the
  selected count and clear button stay at every width. A card too
  narrow for all of them turns the status buttons into a select, and under 28rem
  the range gives way while something is ticked. Shift-click applies the clicked
  box's new state back to the last box clicked, and repeating it on the same box
  flips that whole range back. Signed-out visitors get
  neither checkboxes nor a Recording column. A skip link passes the rows to the
  footer, and Enter on a row's checkbox does the same. Cells render in place, never
  as components, so ticking a row keeps focus on it.
- **Segmented controls** never wrap. Where the segments no longer fit they become
  a native select in the same control dress, so a phone opens its own picker.
- **Date controls** show the house format with the native input laid invisibly
  over it, and a click calls `showPicker`. Where a browser has no real picker for
  the type, the overlay comes off and the arrows do the work.
- **Touch type**: fields use 16px under `pointer-coarse`, so iOS doesn't zoom on
  focus. This keys off the pointer, not the viewport width.
- **Flags** (New, Rare, Vocal, Returned, Regular) stack, render as glyph pills
  with their name in the tooltip, and share a tint with the Highlights line of
  the same name. Their tints never reuse the confidence scale.
- **Recordings**: a bird call has no words, so clips carry no caption track.
  `RecordingButton` where only a button fits, `SpectrogramPlayer`
  where there's room. One clip sounds at a time across the app. Accessible names
  name the bird, except in the quiz, where that would give the answer away, and
  contain any visible label. Give
  the player a `key` per clip; it moves the playhead by `transform` written to the
  DOM, never through React state. Spectrograms draw in the browser, capped at
  15kHz, on the same paper-to-moss ramp as the live feed.
- **Confirmations** all use `ConfirmDialog`: full-size buttons, an icon on each,
  Escape cancels, focus starts on Cancel. Both are `type="button"` because the
  dialog often sits inside the form it guards.
- **Modals** are Radix: `ConfirmDialog`, `ModalDialog`, or `InfoTip`. They hold
  focus and hide the page behind them, then give focus back to what opened them,
  or to `main` if that has gone. The menu drawer does the same by hand so it can
  keep its slide.
- **Sharing**: Share opens a modal showing the exact text that will be sent, on a
  meadow well; opening it sends nothing. Copy is always there, and a touch screen
  with a share sheet adds Share as the primary button.
- **Explanations**: `InfoTip` opens a modal from the info icon. `Hint` is the hover
  tooltip, and a tap opens it too.
- **Outcomes** arrive as toasts, never as a status line or coloured stripe on a
  card. A destructive action that succeeded wears clay, not moss.
- **Announcements**: anything that changes in place without moving focus and that
  a screen reader needs (result counts, a selection, a quiz guess) goes through
  `announce` or `useAnnounceChange`, which speak from one polite region. Live says
  a new main bird at most once a minute and never reads the log.
- **Headings**: a card title is an `h2` (`CardHeader`, or `Kicker as="h2"`), and
  whatever sits under it steps down from there.

## Layout

- The shell is pinned to the viewport and only `main` (`#app-scroll`) scrolls, with
  its scrollbar gutter always reserved. Scroll reset targets `main` and
  `[data-scroll-reset]`; a control that reshapes a view in place passes
  `resetScroll: false`.
- The sidebar takes its column from `xl` (1280px), the narrowest window that still
  fits the timeline's full heat map beside it. Below that the menu bar stands in.
- Anything in a variable-width track responds to its card through container
  queries, not the viewport.
- Grids holding long names use `minmax(0,1fr)` or `grid-cols-1`, never the implicit
  auto track, so a name truncates instead of widening the page.
- Cards are titled with `CardHeader`, a 45px band. Bands, hairlines and rows bleed
  through the card's padding and pad back in with `--page-gap`, never a fixed 16px.
- Mastheads stand `--masthead-h`, level with the sidebar's wordmark band. Their
  words come from `lib/page-headers.ts`.
- The Live hero and the bird page's profile share one geometry (a 120px portrait
  centred in a 9.5rem column), so a bird keeps its size and place between them.
- The bird page's visit log shows 100 rows a page and scrolls inside its card: 10
  rows tall when stacked, and exactly the charts' height beside them, which it never
  stretches.
- Empty wording comes from `lib/empty-messages.ts`: name what's missing and stop.
  A card keeps its title whether full or empty.

## Behaviour

- **Navigation never waits on the server.** `beforeLoad` uses the browser's last
  unlock answer and refreshes it behind the click (`lib/unlock-status.ts`).
- **The URL holds the view**: search, sort, page, period, date. Typed filters
  debounce into it. The search parser is JSON, so any schema that can receive a
  numeric-looking string coerces it (`z.coerce.string()`). A page past the last
  shows the last. Search-bearing nav links set `includeSearch: false`.
- **Time**: detection timestamps are the station's wall clock with no zone and are
  printed as written. "Today" is the station's today (`lib/station-time.ts`), not
  the viewer's. Dates are pinned to en-US and window arithmetic runs in UTC on day
  strings. Ages are measured on the server from one clock reading per snapshot;
  `useAgeOffset` stays 0 through hydration and only moves them forward.
- **Hydration**: the first client render matches the server's. Browser-only values
  (the viewer's zone, sessionStorage, picker support) are read after mount, and
  focus is set from an effect.
- **Polling**: one request at a time, none in a hidden tab, and an answer older
  than the latest is dropped. Full-table reads such as Highlights run from the route
  loader, never on a poll. SQLite is synchronous, so a slow query holds the whole
  server; time filters keep a bare `Date` bound the index can seek on.
- **Timeline**: every real day draws the normal page, whether quiet, ahead or before
  the station. The arrows walk one window at a time with no limit, and a period
  switch re-anchors on the latest day in the window with detections. Only a Daily
  address that isn't a date replaces the page. An empty station keeps its controls.
- **Live** is bounded to a rolling 24 hours. Log rows are visits (`lib/visits.ts`),
  and a bird sits in the hero or the log, not both.
- **Highlights**: the rules are pure and shared by Live and Timeline
  (`lib/highlights-data.ts`), with thresholds and their guide together in
  `lib/highlight-thresholds.ts`. A day with no recordings means the station was
  down: it is skipped, not held against a bird.
- **Rare** has one meaning, the owner's `rareMax`, for the Rare flag and the quiz
  pools alike. Pools split by familiarity, never by time. Nothing on a question may
  point at its answer, and a loader rerun never swaps the round being played.
  A guess is spoken and leaves its choice focusable (`aria-disabled`); focus then
  follows the round: Next after a right answer, the clip after Next, the results at
  the end.
- **Settings**: a save writes the config, then restarts the card's services. A
  refused and a declined restart read the same, and the card keeps offering Restart
  until the values are live. Reset leaves the Station card alone. One tab per card,
  held in the URL (`?tab=`); every card stays mounted behind its tab, so switching
  never drops an unsaved edit. The toolbar's Factory defaults covers every card; a card's own
  footer reset covers only that card and goes through its normal save, and Station
  and Updates have no default to offer one. A card's Save and reset show as disabled
  when there is nothing to do.
- **To do**: Settings lists what's broken or not yet set above its tabs, each with one
  action, and marks Settings in the sidebar; all of it is signed-in only, and with
  nothing to do no section shows. Pure checks live in `lib/health-data.ts`. A state
  that can't be read, or a mid-restart service, is unknown and never listed, and audio
  and the analyzer wait out 5 minutes of uptime. Audio is judged by the `StreamData`
  folder's own mtime, because the analyzer deletes the files. A station name equal to
  the hostname counts as unset, because the installer writes that. A purging disk
  alarms 2 points past `PURGE_THRESHOLD`, since it rests near that line when healthy;
  a keeping disk warns 5 points before it, since services stop there. The card keeps
  the normal header, and its rows wear the error tones (`--toast-error-fill`, `--toast-error-line`)
  with clay titles and bark text, the one place a whole row goes red.

## Data and security

- **`detections` can't grow a column**: BirdNET-Pi's writers INSERT positionally, so
  a new column stops the station recording. Review state lives in `reviews`, keyed
  on date, time, species and file (rowids get recycled), created on first write and
  never on a read path. Review never writes to `detections.Confidence`, and a
  sign-off is removed with its detection.
- **The gate is on the server.** Route checks only decide what renders; every gated
  server function chains `requireUnlocked`. Any failure to read auth means locked,
  never open.
- **Clips can carry voices.** Signed out, only each species' best recording plays,
  enforced in `/api/audio`. Audio responses are `private, no-cache`, and fetched
  clips are forgotten on sign-out.
- **Public reads never carry `Lat` or `Lon`**: the coordinates are the owner's home.
- **Passwords**: there is no default. The file is written temp-then-rename at 0600,
  the CLI reads stdin and never argv, and an unreadable file is an error, not "unset".
- **Client addresses** come from proxy headers only under `WEB_UI_TRUSTED_PROXY`, and
  then only `CF-Connecting-IP` or the last `X-Forwarded-For` hop. Only off-LAN
  failures feed the global throttle, so a remote attacker can't lock the owner out.
- **`birdnet.conf`**: write through a temp file beside the real file, which keeps the
  symlink a symlink. Leave every other line untouched and append a missing key.
- **`systemctl`**: service names are validated against the known cards and its output
  never reaches the browser. Updates start with `--no-block`, since an install
  restarts this server.
- **Client bundles**: modules imported by client code stay free of server imports,
  with pure metadata split out (`timeline-periods.ts`, `learn-pools.ts`).
