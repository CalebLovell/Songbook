# How I build websites

Instructions for any agent building a website with me. These rules apply to every project. A project's own colours, sizes and components belong in its design doc, such as `DESIGN.md`.

## Design

- Always make a design document first, before building any UI.
- Everything is mobile accessible and responsive down to 320px, in every state.

## Framework

- Build with React and TanStack Start on Vite, and follow the way TanStack intends things to be done.
- Use the framework's own tool for a job before writing one: file-based routes, `validateSearch`, `loader`, `loaderDeps`, `beforeLoad`, `head` and `createServerFn`.
- Before working in an area of the framework, load its current guidance with `@tanstack/intent`.
- Let TanStack's types flow through routes, search params and loader data.
- Code in `*.server.ts` runs only on the server. Never import it from client components.

## Pages

- Every page is a file-based route.
- A route declares its title, the search params it accepts, its loader and its component.
- Pages assemble cards. Pages, cards and functions have clear boundaries.
- Links preload on intent, so the next page is already on its way.

## URLs

- If someone would want to share it, bookmark it or come back to it, it lives in the URL: filters, sorts, pages, tabs, selected periods.
- Validate search params in the route, and let `loaderDeps` refetch when they change.
- Back and forward always work.

## Components

- The component is the unit of work. Its structure, behaviour and styling live together in one file.
- Style with Tailwind. Global CSS holds only tokens, base element rules, keyframes and overrides for markup we don't own.
- If a class repeats, make a component rather than a CSS class.

## States

Most bugs and most unfinished design live in the states nobody drew. Every page, card and component accounts for every state before it counts as done.

| State | What it means |
| --- | --- |
| Empty | No data yet, or nothing matches |
| Normal | Typical data |
| Overflowing | Long names, big numbers, far more data than anyone expects |
| Loading | Data hasn't arrived |
| Error | The request failed |

## Data and loading

- Navigation is instant. The page frame appears at once, and each card loads on its own.
- A route's loader starts its server calls and returns the promises without awaiting them.
- Each card waits for its own promise and shows its loading shell until the data lands.
- Anything that doesn't depend on the data, such as titles and controls, renders immediately.
- A loading shell measures the same as the loaded card, so nothing shifts when data arrives.
- Controls never move under the cursor.
- Shells are built from the card's own markup so the two can't drift apart.
- Every read and write goes through a server function. After a write, `router.invalidate()` refreshes what's on the page.
- Loaders own what a route needs to render. TanStack Query owns everything a loader can't: data that polls while the page is open, and data asked for on demand, such as a page inside a card or an index fetched on first focus.
- Every write is a `useMutation`. Its pending and error state come from the mutation, never from `useState` and `try`/`finally`.
- Create the `QueryClient` in the router factory, so server requests never share a cache, and pass it through router context. Loaders prefetch queries in the browser, so links still preload on intent.

## React Hooks

An effect keeps React in sync with something outside React. If nothing outside React is involved, an effect is the wrong tool. Code that runs because the user did something belongs in the event handler; code that runs because the component is on screen may belong in an effect.

Before writing `useEffect`, check this list:

| To do this | Use |
| --- | --- |
| Compute a value from props or state | A calculation during render, with `useMemo` only if it's measurably slow |
| Reset all of a component's state when a prop changes | A `key` |
| Keep an editable draft of a prop, or adjust some state when a prop changes | `setState` during render, guarded by a comparison with the previous value |
| Respond to a click or submit | The event handler |
| Trigger something in a child from a parent | Move the logic to where the event happens, never a counter prop the child watches |
| Tell a parent about a change | The callback, in the same event handler as the state change, or lifted state |
| Read a browser-only value | `useSyncExternalStore` with a server snapshot, which avoids a second render and a hydration mismatch |
| Subscribe to a store outside React | `useSyncExternalStore` |
| Load what a route renders | The route's `loader` |
| Fetch or poll anything else | `useQuery`, never `useEffect` and `fetch` |
| Change data on the server | `useMutation` |

Effects still belong around timers, global event listeners, canvas and media elements, and cleanup on unmount.

- An effect does one job. Two jobs are two effects, and an effect with a job worth naming becomes a custom hook.
- Don't lie about dependencies. Suppressing the dependency lint usually means the logic belongs in an event handler or in render.
- Effects that set state to trigger other effects are a design problem. Compute the next state in one place.
- An effect that starts something asynchronous cleans up after itself, so a late result can't overwrite a newer one.

## Code

- Name things well, so the code explains what it does.
- Don't write comments. Put lasting rules in the design doc. The only exceptions are tool directives and a one- or two-line "why" where correct code looks wrong.
- Keep logic out of components, in plain functions.

## Enforcement

- Biome handles formatting, linting, import order and Tailwind class order.
- TypeScript checks everything with `tsc --noEmit`.
- Write very few tests, only where absolutely necessary, plus some end-to-end tests.
- Biome, TypeScript and the tests run in a pre-push hook on `main`. CI runs them again along with a production build.
- If a tool can check a rule, the tool enforces it.
