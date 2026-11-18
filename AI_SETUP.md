# Setting up a Songbook station: instructions for AI assistants

You are helping a person turn a Raspberry Pi into a Songbook station from scratch. You work from
their Linux computer, with a shell and a terminal they can see and type into. Instructions for
people doing this themselves are in [SETUP.md](SETUP.md).

This sequence was last run end to end in November 2026, on a Raspberry Pi 3B+ with Raspberry Pi OS
Lite (64-bit, Trixie) and a KTMicro USB microphone.

## Rules

- **The person types every secret.** Wi-Fi password, their computer's sudo password and the web UI
  password are typed by them, at a prompt in a terminal they can see. Never ask for a secret in chat,
  put one in a command line, or type one yourself.
- **The person handles the hardware.** Assembling, moving the card, plugging in and powering on.
  Tell them exactly what to do, then wait for them to say it's done.
- **Confirm before erasing.** Show the card you found (name, size, contents) and get a yes before
  writing to it. The flashing tool asks again at the terminal.
- **Check each step before the next.** Every step below says what success looks like. If it
  doesn't match, stop and go to [When something is wrong](#when-something-is-wrong).
- Run long commands in the background and wait for them to finish; don't poll in a tight loop.

## Before you start, ask the person

1. **Which Pi?** 5, 4B or 3B+. A 3B+ can only use 2.4 GHz Wi-Fi.
2. **Wi-Fi or Ethernet?** For Wi-Fi, the network name and country code. You can read the name
   their computer is on with `nmcli -t -f active,ssid dev wifi | grep '^yes'`.
3. **A hostname** for the station: lowercase letters, digits and hyphens, unique on their network.
   It becomes `http://<hostname>.local`.
4. **Is the microSD card in this computer's reader?**

Read the rest from the computer: user (`$USER`), time zone
(`timedatectl show --value -p Timezone`), and an SSH key (`ls ~/.ssh/*.pub`). If there is no key,
make one with `ssh-keygen -t ed25519` after telling them.

## 1. Find the card

```bash
lsblk -o NAME,SIZE,TYPE,TRAN,RM,MODEL,MOUNTPOINTS
```

The card is usually `mmcblk0` (built-in reader) or `sdX` with `TRAN` `usb`, 8–256 GB. Look at what
is on it (`ls` its mount point) and tell the person: "/dev/mmcblk0, 32 GB, empty. Erase it?"
Continue only on a clear yes.

## 2. Write the card

Run the flashing tool **in a terminal the person can type into**, not a hidden shell, from the
repository root:

```bash
tools/flash_sd_card.sh --device /dev/mmcblk0 --hostname songbook --wifi "Network name" --country US
```

Leave out `--wifi` and `--country` for Ethernet. The tool downloads the newest Raspberry Pi OS
Lite (64-bit), checks it against the published sha256, and caches it in `~/.cache/songbook`. Then
the person types, in order: the Wi-Fi password, `yes` to erase, and their sudo password.

**Success:** it ends with "The card is ready." Writing takes 2–5 minutes.

## 3. First boot

Tell the person:

1. If the Pi goes in a case with a fan, connect the fan to the **3.3 V** pins: red to pin 1, black
   to pin 6. Stick on the heatsinks, peeling their film first.
2. Put the card in the Pi and **plug in the USB microphone** (any port).
3. Connect power.

Wait for it to answer, for up to 10 minutes:

```bash
until ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new <user>@<hostname>.local true; do sleep 15; done
```

**Success:** SSH connects, usually within 2–4 minutes of power-on. It reboots once by itself.

If nothing answers after 10 minutes, first ask whether the Pi is actually powered and what its
LEDs do. Then see [The Pi never appears](#the-pi-never-appears).

## 4. Check the Pi before installing

```bash
ssh <user>@<hostname>.local 'uname -m; grep VERSION_CODENAME /etc/os-release; sudo -n true && echo sudo-ok; free -m | head -2; df -h / | tail -1; arecord -l'
```

**Success:**
- `aarch64`, `VERSION_CODENAME=trixie` and `sudo-ok`.
- At least 1 GB of free disk.
- `arecord -l` lists a capture device, the microphone. If none is listed, ask the person to reseat
  the mic before installing.

## 5. Install

Run this **in a terminal the person can type into**, because it asks them for the web UI password:

```bash
ssh -t <user>@<hostname>.local 'curl -s https://raw.githubusercontent.com/CalebLovell/Songbook/main/newinstaller.sh | bash'
```

Tell the person that near the end it asks for a password for the web UI's Settings, Review and
Species filter, that the prompt shows nothing as they type, and to check Caps Lock.

**Success:** "Installation completed successfully", then "Connection … closed" as the Pi
reboots. This took about 10 minutes on a 3B+.

## 6. Verify

Wait for SSH again (step 3), then give the services a minute:

```bash
ssh <user>@<hostname>.local 'systemctl is-active birdnet_recording birdnet_analysis birdnet_web_ui; systemctl --failed --no-legend; sudo test -f /etc/birdnet/web-ui/auth.conf && echo password-set; grep -E "^(LATITUDE|LONGITUDE|SITE_NAME)=" /etc/birdnet/birdnet.conf; hostname -I'
```

**Success:**
- Three `active` lines and no failed units.
- `password-set`. If it's missing, see [The password was never asked
  for](#the-password-was-never-asked-for).
- A latitude and longitude that are not both 0.
- The Pi's IP address, which you give the person along with the `.local` address.

Then check that the microphone is heard:

```bash
ssh <user>@<hostname>.local 'journalctl -u birdnet_analysis --since "-2 min" --no-pager | grep -c "DONE"'
```

A count above 0 means recordings are being analysed. Then check the pages:

```bash
ssh <user>@<hostname>.local 'for page in live timeline birds learn; do curl -s -o /dev/null -w "%{http_code} " http://localhost/$page; done'
```

**Success:** `200 200 200 200`.

## 7. Hand over

Tell the person:

- Open `http://<hostname>.local`, or `http://<IP address>` if that name doesn't load. Type the
  `http://`.
- Sign in and open **Health**. Every card should be plain, or yellow only for the default name
  "Backyard Station", which they can change. **Audio input** should name the microphone and say
  it is hearing sound.
- Check **Location** is right, since it decides which birds are expected.
- To test detection, play a recording of a bird that lives nearby from a phone, about 30 cm from
  the mic, for 30 seconds in a quiet room. You can watch for it:

```bash
ssh <user>@<hostname>.local 'sqlite3 ~/BirdNET-Pi/scripts/birds.db "select Com_Name, round(Confidence,2), Time from detections order by rowid desc limit 5"'
```

## When something is wrong

### The Pi never appears

- `getent hosts <hostname>.local` returns nothing, and a ping sweep of the network finds no
  Raspberry Pi MAC address (prefixes `b8:27:eb`, `dc:a6:32`, `e4:5f:01`, `d8:3a:dd`, `2c:cf:67`):
  it didn't boot or didn't join Wi-Fi.
- Ask about the LEDs. Red only, with no green flicker, means it isn't reading the card. A blinking
  or dark red LED means weak power.
- A mistyped Wi-Fi password or a 5 GHz-only network on a 3B+ gives exactly this result. Ethernet
  rules out Wi-Fi: with a cable, SSH works and `journalctl -u NetworkManager` shows the Wi-Fi error.

### The password was never asked for

The installer log (`~/installation-<date>.txt` on the Pi) says "The web UI has no password yet".
Have the person set it in a terminal they can type into:

```bash
ssh -t <user>@<hostname>.local 'sudo ~/BirdNET-Pi/scripts/set_web_ui_password.sh'
```

### The person can't sign in

The web UI logs each wrong password: `journalctl -u birdnet_web_ui | grep "failed unlock"`. It
reads the password file on every attempt, so a restart never helps. Have them set it again as
above. After 5 wrong tries, sign-in makes them wait 30 seconds, doubling each time.

### The browser can't find the station

`DNS_PROBE_FINISHED_NXDOMAIN` in Chrome usually means its **Use secure DNS** setting is sending
`.local` names to an internet DNS provider. Give the IP address instead. Android often can't use
`.local` names at all.

### Health says no microphone, or silence

With no capture device, PulseAudio falls back to a silent monitor and recording carries on, so
recordings exist but are digital silence. Check `arecord -l` and
`ssh <user>@<hostname>.local 'pactl get-default-source'`, which names the USB mic when it's
working. Unplugging and replugging recovers by itself. Fan vibration or knocks reaching the mic
show up as low-confidence guesses of species like Australian Brushturkey; these are filtered out
by location, but move the mic away from the case.
