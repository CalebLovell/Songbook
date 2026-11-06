# Songbook web UI

The station's web interface, built with TanStack Start. UI rules live in
[`DESIGN.md`](DESIGN.md).

## Getting started

```bash
npm install
npm run dev
```

To build for production:

```bash
npm run build
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `BIRDNET_CONF` | `/etc/birdnet/birdnet.conf` | Station configuration read and written by the Settings page. |
| `BIRDNET_DB_PATH` | `../scripts/birds.db` | The detections database. |
| `BIRDNET_AUTH_CONF` | `/etc/birdnet/web-ui/auth.conf` (`.dev/auth.conf` under `npm run dev`) | Where the web UI password hash lives. |
| `WEB_UI_TRUSTED_PROXY` | unset | When set, `X-Forwarded-For` is trusted for identifying the client address. Set it only when something you control actually terminates TLS in front of the app -- trusting the header without a proxy lets a client spoof its own address and evade unlock throttling. |

## Signing in during development

A real station has no default password. `npm run dev` gives itself one so the gated pages
can be tested with no setup: on start it creates `.dev/auth.conf` (gitignored) with the
password **`birdnet-dev-password`** (`src/lib/dev-password.ts`), if the file is missing.

- The Account page has a **Dev sign-in** button, beside Unlock, that signs in with it
  through the normal request. **Lock this browser** signs out. The button is only in the
  dev server, never in a build.
- To see the "No password yet" screen, delete `.dev/auth.conf`; restarting the dev server
  puts it back. To see "Sign-in unavailable", put garbage in it.
- Setting `BIRDNET_AUTH_CONF` yourself turns all of this off.
