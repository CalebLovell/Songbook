# Setting up a Songbook station

This guide takes a Raspberry Pi from a blank memory card to a station that is listening, and covers
running it afterwards. It is written for people and for AI assistants doing the setup on someone's
behalf, so every step says what you should see when it worked.

It was last run end to end in November 2026 on a Raspberry Pi 3B+ with Raspberry Pi OS Lite
(64-bit, Trixie) and a KTMicro USB microphone. That run confirmed every step except a first
detection from a live bird. Please open an issue if anything differs for you.

- [What you need](#what-you-need)
- [1. Put it together](#1-put-it-together)
- [2. Prepare the memory card](#2-prepare-the-memory-card)
- [3. Install Songbook](#3-install-songbook)
- [4. Open the web UI](#4-open-the-web-ui)
- [5. Check the Health page](#5-check-the-health-page)
- [The first hour](#the-first-hour)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)
- [Backup and restore](#backup-and-restore)
- [Making a station public](#making-a-station-public)
- [Uninstalling](#uninstalling)

## What you need

- **A Raspberry Pi 5, 4B or 3B+.** The [BirdNET-Pi page at Cornell](https://birdnet.cornell.edu/birdnet-pi/)
  recommends the 5 and 4B. A 3B+ works: in our run it analysed each 15-second recording in about
  2.6 seconds and had about 400 MB of memory to spare. Songbook needs a 64-bit OS.
- **A microSD card, high-endurance, 32 GB or larger.** 64 GB gives more room for recordings, as
  [this hardware guide](https://github.com/wr/featherframe/wiki/Hardware-BirdNET) suggests.
- **The official power supply.** A weak one makes the Pi unreliable, and Health warns about it.
- **A case with a fan** is worth having for a station that runs all day.
- **A USB microphone.** Any port on the Pi works. Start with the first one here unless you already
  know you want more:

| Microphone | Why | Catch |
| --- | --- | --- |
| **Boya BY-LM40** | Inexpensive and plugs straight into USB. Cornell names Boya among its preferred plug-and-play brands, alongside Saramonic. | [Less sensitive](https://github.com/wr/featherframe/wiki/Hardware-BirdNET) than the option below. |
| **Clippy EM272** (Micbooster) with a mono USB sound card | [Described as](https://github.com/wr/featherframe/wiki/Hardware-BirdNET) the most recommended in the BirdNET-Pi community, and much more sensitive. | More parts. Cornell [advises avoiding external sound cards](https://birdnet.cornell.edu/birdnet-pi/) because of ground-loop buzz. |

Interface, gain and background noise can matter as much as the mic's price; one
[BirdNET-Pi discussion](https://github.com/Nachtzuster/BirdNET-Pi/discussions/639) is worth reading
first.

You also need a computer on the same network to prepare the card and open the web UI.

## 1. Put it together

- **Heatsinks:** peel the film off each one before sticking it on.
- **Fan:** if your case has one, connect it to the **3.3 V** pins (low speed): red to pin 1, black
  to pin 6. It is quiet and keeps a Pi cool enough. Use 5 V only if the Pi runs hot. Getting red and
  black the wrong way round can damage the fan.
- **Microphone:** plug it in before powering on. Keep it away from the case: fan vibration and
  knocks reach the recordings as low thumps, which BirdNET can mistake for birds.
- **Placement:** outdoors, away from traffic, fans and your own voice, and sheltered from wind and
  rain. Cornell suggests a weatherproof junction box or a birdhouse-style mount, with acoustic
  fabric over the mic.

## 2. Prepare the memory card

Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer:

1. **Device:** your Pi model.
2. **Operating system:** Raspberry Pi OS (other) → **Raspberry Pi OS Lite (64-bit)**.
3. **Storage:** the microSD card. Everything on it is erased.
4. **Customisation:** set all of these before writing.
   - **Hostname:** the station's network name. It becomes `http://<hostname>.local`, so each Pi
     needs its own. If you leave it as `raspberrypi`, the installer renames it `birdnetpi`.
   - **Username and password**, or an SSH public key. The installer needs the user to have
     passwordless sudo, which is the Imager's default.
   - **Wi-Fi name, password and country**, unless you use Ethernet. A Pi 3B+ can only join a
     2.4 GHz network.
   - **Time zone.** Detection times use it.
   - **SSH: on.**
5. Write the card, put it in the Pi and power it on.

**You should see:** after 2–4 minutes, the Pi answers on your network:

```bash
ssh <user>@<hostname>.local
```

Before installing, check the OS, sudo and the mic:

```bash
uname -m && grep VERSION_CODENAME /etc/os-release && sudo -n true && echo sudo-ok
```

```bash
arecord -l
```

The first prints `aarch64`, `VERSION_CODENAME=trixie` and `sudo-ok`. The second lists your mic as
a capture device.

## 3. Install Songbook

On the Pi, as your normal user:

```bash
curl -s https://raw.githubusercontent.com/CalebLovell/Songbook/main/newinstaller.sh | bash
```

It installs the newest release and everything it needs. This took about 10 minutes on a 3B+.

1. **Near the end it asks you to choose a password** for the web UI's Settings, Review and Species
   filter. The prompt shows nothing as you type, so check Caps Lock, then type it twice.
2. **Then it reboots,** which ends your SSH session. That is expected.

It keeps a log at `~/installation-<date>.txt`. It also guesses the station's location from your
IP address using ip-api.com, which decides which species are expected there. If you left the
Imager's time zone at its default, it takes the time zone from the same guess.

## 4. Open the web UI

From a computer or phone on the same network, open `http://<hostname>.local`, for example
`http://birdnetpi.local`. Type the `http://`, or browsers may search for it instead.

If it doesn't load, use the Pi's IP address instead, from your router or `hostname -I` on the Pi.
See [Can't reach the station](#cant-reach-the-station).

Anyone who can reach the station can view it. Sign in with your password to see Health, Settings,
Review and Species filter.

## 5. Check the Health page

Sign in and open **Health**. It shows one card per part of the station, and anything that needs
fixing turns yellow or red with what to do.

- **Audio input** names your microphone and shows how loud it is hearing, for example
  "Hearing sound, peaking at −42 dB". If no mic is plugged in, or it records silence, the card
  turns red. Fix it at the Pi, then press **Check again**.
- **Location** stays yellow, showing roughly where the installer's guess points and the time
  zone, until you press **Check location** and save. A VPN can make the guess wrong, and species
  filtered out by a wrong location can't be recovered afterwards. Later, the card warns if the
  time zone is hours away from the location.
- **Name:** new stations are called "Backyard Station". Visitors see the name, so change it to one
  of your own if you like, but don't use your address.

## The first hour

- The station records 15-second chunks and analyses each one, so a bird should appear within a
  minute or so of being heard.
- Pages stay empty until the first detection. That is normal, especially at midday or at night.
  Dawn is the best first test.
- **To test now,** play a recording of a bird that lives near you from your phone, about 30 cm
  (a foot) from the mic, for 30 seconds, with the room quiet. A bird that doesn't live in your area
  is filtered out by design.
- Only detections at 70% confidence or higher are kept (**Settings → Detection**). Expect some wrong
  guesses at first. Use **Review** to correct them rather than lowering the threshold right away.
- Most of the interesting pages (trends, regulars, Highlights) need days of data to mean much.

## Troubleshooting

### No birds after a few hours

Start with **Health → Audio input**. If it is red, it says what is wrong. If it is green, check
that recording and analysis are running:

```bash
journalctl -u birdnet_recording -u birdnet_analysis --since "1 hour ago"
```

Then play a clear bird call from a phone close to the mic. If it isn't detected, suspect the mic or
its distance. If it is, the problem is placement or noise.

### Wrong location, or the wrong kinds of birds

A VPN or an unusual internet connection can give a bad guess, and a failed lookup leaves the
location at 0, 0. Set the real values on **Health → Location**.

### Microphone not found

Health says "No microphone is plugged in". List what the Pi can see:

```bash
arecord -l
```

If the mic is missing, try another USB port or a powered hub. If it's listed but Health says it
hears nothing, check **Settings → Audio input**: the recording device should be `default`.

### Can't reach the station

- **Type the `http://`.** Without it, browsers often search for the name instead.
- **Use the IP address.** Names ending in `.local` don't work on every device or network. Android
  often can't use them.
- **Chrome says `DNS_PROBE_FINISHED_NXDOMAIN`:** Chrome's **Use secure DNS** (`chrome://settings/security`)
  sends every lookup to an internet DNS provider, which doesn't know `.local` names. Use the IP
  address, or set that option to your current service provider.
- **Same network:** your device must be on the same network as the Pi, not a guest or IoT network.

### Sign-in says the password is wrong

Set a new one on the Pi. There is no default password and no reset by email.

```bash
sudo ~/BirdNET-Pi/scripts/set_web_ui_password.sh
```

The prompt shows nothing as you type. After 5 wrong tries, sign-in makes you wait 30 seconds, and
each further wrong try doubles the wait.

## Updating

Stations update from this repository's GitHub releases. **Health → Updates** shows the installed
version and the newest release, with **Check**, **Update to …** and an **Install automatically**
switch (`AUTOMATIC_UPDATE` in `birdnet.conf`). Every night between 3 and 5 AM
`birdnet_update.timer` looks for a new release: with the switch on it installs it, with it off it
only marks Health in the sidebar so you can install it when you like.

```bash
update_birdnet.sh        # install the newest release now
update_birdnet.sh -c     # only check
```

An update downloads the release's prebuilt web UI beside the running one, checks it against the
sha256 in the release's `release.json`, moves the code to the release's commit, and restarts. If the
web UI doesn't answer afterwards, the station goes back to the version it had. Progress is in
`~/BirdNET-Pi-web/update-status.json` and `journalctl -u birdnet_update_now`.

## Backup and restore

Download a backup from **Health → Backups**, or on the Pi:

```bash
./scripts/backup_data.sh -a backup -f /mnt/birds/backup.tar
./scripts/backup_data.sh -a restore -f /mnt/birds/backup.tar
```

## Making a station public

> [!CAUTION]
> **A public station is a public microphone. Read this first.**
> - **Visitors can play one clip per species.** Those clips are real audio from wherever your mic
>   is. Every other recording and the live stream require sign-in.
> - **Each public clip is checked for a human voice first.** A voice check runs on the species' best
>   clip. If it hears a voice, the clip stays private and the next-best clip is checked instead. A
>   clip stays private until it passes. In testing, the check caught every voice 10 dB quieter than
>   the bird, about 60% at 20 dB quieter, and few at 30 dB quieter, so a faint voice can still get
>   through. It also listens only for voices, not for other household sounds.
> - **The recording filter can miss speech too.** It drops audio when BirdNET ranks a human sound
>   among its top predictions. `PRIVACY_THRESHOLD` (**Settings → Privacy**, 0–3) widens how far down
>   the list it looks, and 0 still checks the top 10. Keep the mic away from patios, windows and
>   sidewalks.
> - **Recording laws vary by place**, especially for conversations and neighbors. Check yours
>   before putting the mic outside or the station online. This is not legal advice.
> - **Coordinates stay private.** Public pages don't include your latitude or longitude. The station
>   name is shown publicly, so don't use your address.

The web UI serves port 80 on your network. To reach it from the internet, put a tunnel or reverse
proxy that you control in front of it, then tell the web UI to trust the address that proxy
forwards. Sign-in throttling then sees real visitors, and link previews use your public address.

```bash
sudo systemctl edit birdnet_web_ui.service
```

```ini
[Service]
Environment=WEB_UI_TRUSTED_PROXY=1
```

Only set this behind a proxy running on the Pi itself, such as `cloudflared`. The app trusts
forwarded addresses only from a connection on the same machine, so other devices on your network
can't fake theirs.

## Uninstalling

```bash
/usr/local/bin/uninstall.sh && cd ~ && rm -drf BirdNET-Pi
```
