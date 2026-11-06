<p align="center">
  <img src="web-ui/public/songbook.svg" alt="Songbook" width="240" />
</p>
<p align="center">
A record of every bird singing in your yard, on a Raspberry Pi.
</p>

Songbook listens through a microphone around the clock, identifies birds with the
[BirdNET](https://github.com/kahst/BirdNET-Analyzer) model, and keeps a searchable record of
them in a web interface you host yourself.

**Non-commercial use only.** See [License and credits](#license-and-credits).

## Requirements

- A Raspberry Pi 5, 4B, 400, 3B+ or Zero 2 W
- An SD card with the **64-bit** version of Raspberry Pi OS (Trixie; Lite is recommended)
- A USB microphone or sound card
- A user with passwordless sudo, which is the Raspberry Pi OS default

## Installation

Run this on the Pi, as your normal user:

```bash
curl -s https://raw.githubusercontent.com/CalebLovell/Songbook/main/newinstaller.sh | bash
```

The installer takes care of updates and dependencies, so it can be the first command you run
on a new Pi. It installs the newest release, asks you to choose a password for the web UI, and
reboots. It keeps a log at `~/installation-<date>.txt`.

Open `http://birdnetpi.local`, or the Pi's IP address, from a browser on the same network.
Viewing is open to anyone who can reach the station; Settings, Review and Species control need
the password. To set it again:

```bash
sudo ~/BirdNET-Pi/scripts/set_web_ui_password.sh
```

## Updating

Stations update from this repository's GitHub releases. Settings → Updates shows the
installed version and the newest release, with **Check** (asks GitHub now and says what it
found) and **Update to …**, and an **Automatic updates** switch (`AUTOMATIC_UPDATE` in
`birdnet.conf`). Every night between 3 and 5 AM `birdnet_update.timer` looks for a new release:
with the switch on it installs it, with it off it only marks Settings in the sidebar so you can
press Update when you like.

From a shell:

```bash
update_birdnet.sh        # install the newest release now
update_birdnet.sh -c     # only check
```

An update downloads the release's prebuilt web UI beside the running one, checks it
against the sha256 in the release's `release.json`, moves the code to the release's commit,
and restarts. If the web UI doesn't answer afterwards, the station goes back to the version
it had. Progress is in `~/BirdNET-Pi-web/update-status.json` and
`journalctl -u birdnet_update_now`.

## Making a station public

The web UI serves port 80 on your network. To reach it from the internet, put a tunnel or
reverse proxy that you control in front of it, then tell the web UI to trust the address that
proxy forwards, so sign-in throttling sees real visitors:

```bash
sudo systemctl edit birdnet_web_ui.service
```

```ini
[Service]
Environment=WEB_UI_TRUSTED_PROXY=1
```

Only set this behind a proxy. Without one, visitors could fake their address.

## Backup and restore

```bash
./scripts/backup_data.sh -a backup -f /mnt/birds/backup.tar
./scripts/backup_data.sh -a restore -f /mnt/birds/backup.tar
```

## Uninstalling

```bash
/usr/local/bin/uninstall.sh && cd ~ && rm -drf BirdNET-Pi
```

## Development

The web UI is in [`web-ui/`](web-ui/README.md), and its design rules are in
[`web-ui/DESIGN.md`](web-ui/DESIGN.md). The recording and analysis services are in `scripts/`.

Releases are automatic. Every push to `main` runs `.github/workflows/release.yml`, which
checks the web UI and then lets [semantic-release](https://semantic-release.gitbook.io/)
read the [Conventional Commits](https://www.conventionalcommits.org/) since the last
release to pick the version:

| Commit message | Release |
| --- | --- |
| `fix(ui): …`, `perf: …` | patch: 1.4.0 → 1.4.1 |
| `feat(ui): …` | minor: 1.4.0 → 1.5.0 |
| `feat(ui)!: …`, or a `BREAKING CHANGE:` footer | major: 1.4.0 → 2.0.0 |
| `test:`, `docs:`, `chore:`, `refactor:`, `style:`, `ci:` | none |

The highest one among the new commits wins. When there is a release, it builds the web UI
bundle (`scripts/package_release.sh`), tags the commit `vX.Y.Z`, and publishes
the GitHub release with notes grouped from the commit messages.

The checks (Biome, TypeScript, tests) run first, and a failing check means no release.
`.githooks/pre-push` runs the same checks before a push to `main`; turn it on once per clone
with `git config core.hooksPath .githooks`.

## License and credits

Songbook is licensed under [CC BY-NC-SA 4.0](LICENSE), inherited from the projects it builds
on. **You may not use it to develop a commercial product.**

- [BirdNET](https://github.com/kahst/BirdNET-Analyzer), the model that identifies the birds, is
  by [@kahst](https://github.com/kahst) and the K. Lisa Yang Center for Conservation Bioacoustics
  at the Cornell Lab of Ornithology.
- Songbook began as a fork of [BirdNET-Pi](https://github.com/mcguirepr89/BirdNET-Pi) by
  [@mcguirepr89](https://github.com/mcguirepr89), continued by
  [@Nachtzuster](https://github.com/Nachtzuster/BirdNET-Pi).
- Translated bird names are thanks to [@patlevin](https://github.com/patlevin) and Wikipedia.
