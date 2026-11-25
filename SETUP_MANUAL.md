# Set up a Songbook station

From a blank memory card to a station that hears birds, in about 30 minutes. Using an AI
assistant instead? Give it [AI_SETUP.md](AI_SETUP.md).

## What you need

One of each:

| Part | What we use | Tested |
| --- | --- | --- |
| Raspberry Pi | [Pi 3 Model B+](https://www.pishop.us/product/raspberry-pi-3-model-b-plus/) or [Pi 4 Model B, 1 GB](https://www.pishop.us/product/raspberry-pi-4-model-b-1gb/) | 3B+ yes, 4 not yet |
| Case with fan and power supply | [Miuzei](https://www.amazon.com/stores/Miuzei/page/8572E409-B226-42AA-AEF9-99D89C6E2E3D), for your Pi model | Pi 3 yes, Pi 4 not yet |
| microSD card, 32 GB | [SanDisk Ultra 32 GB](https://www.amazon.com/dp/B08GY9NYRM) | A PNY 32 GB, yes |
| USB microphone | [Movo M1](https://www.amazon.com/dp/B0176NRE1G) | Yes |

Any Raspberry Pi 5, 4B or 3B+ works. You also need a computer on the same Wi-Fi.

## 1. Assemble

1. Peel the film off the heatsinks and stick them on the chips.
2. Connect the fan to the **3.3 V** pins: red to pin 1, black to pin 6. (5 V is louder.)
3. Put the Pi in the case. Leave the memory card out for now.
4. Plug the microphone into any USB port.

## 2. Write the memory card

1. On your computer, install [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
   **2.0 or newer**. On Linux, use the download from that page: older versions from your
   package manager ignore the Wi-Fi and SSH settings below.
2. Put the memory card in your computer and open Imager.
3. Choose:
   - **Device:** your Pi model.
   - **OS:** Raspberry Pi OS (other) → **Raspberry Pi OS Lite (64-bit)**.
   - **Storage:** the memory card. It will be erased.
4. When it offers customisation, fill in every setting:
   - **Hostname:** leave it as `raspberrypi`. Songbook renames it later.
   - **Username and password:** your choice. You use them in step 3.
   - **Wi-Fi:** network name, password and country. A Pi 3B+ can only use 2.4 GHz Wi-Fi.
   - **Time zone:** yours.
   - **SSH:** on, with password login.
5. Write the card. It takes a few minutes.

## 3. Start the Pi

1. Put the memory card in the Pi and plug in the power.
2. Wait 3 minutes.
3. On your computer, open a terminal and log in to the Pi:

   ```bash
   ssh <username>@raspberrypi.local
   ```

   Type `yes` if asked to trust it, then your password.

**You should see** a prompt ending in `@raspberrypi:~ $`.

## 4. Install Songbook

Paste this into that terminal:

```bash
curl -s https://raw.githubusercontent.com/CalebLovell/Songbook/main/newinstaller.sh | bash
```

1. Wait about 10 minutes.
2. When asked, choose a password for the Songbook website. Nothing shows as you type. Type it
   twice.
3. It prints the station's address and restarts the Pi. Note the address.

**You should see** `http://songbook.local`, or `http://songbook-2.local` if you already have a
station.

## 5. Open the station

1. Wait 2 minutes for the Pi to restart.
2. In a browser, open the address from step 4. Type the `http://`.
3. Sign in with your Songbook password and open **Health**.
4. Fix anything yellow or red. Each card says how. In particular:
   - **Location:** press **Check location**, correct it if needed, and save. It decides which
     birds count.
   - **Name:** press **Change name** and pick one. Visitors see it, so don't use your address.

**You should see** **Audio input** naming your microphone and "Hearing sound".

## 6. Test it

Play a recording of a local bird from your phone, about 30 cm (a foot) from the microphone, for
30 seconds, in a quiet room.

**You should see** the bird on the **Today** page within a minute.

Real birds are easiest to hear at dawn. Birds that don't live near you are filtered out.

## Placing the station

Outdoors, sheltered from rain and wind, away from roads, fans and people talking. Keep the
microphone away from the case, so the fan's hum doesn't reach it.

## If something goes wrong

**`ssh` says it can't find `raspberrypi.local`.** Wait 2 more minutes. Then find the Pi's
address in your router's device list and use `ssh <username>@<address>`. If the Pi isn't there,
it didn't join Wi-Fi: rewrite the card, checking the Wi-Fi password and that Imager is 2.0 or
newer.

**The browser can't open the station.**
- Type `http://` before the address.
- Try the IP address the installer printed.
- Chrome with `DNS_PROBE_FINISHED_NXDOMAIN`: turn off **Use secure DNS** in
  `chrome://settings/security`, or use the IP address.
- Your device must be on the same Wi-Fi as the Pi, not a guest network.

**Audio input says no microphone, or silence.** Unplug the microphone, plug it into another USB
port, then press **Check again**.

**The password doesn't work.** Set a new one. Log in to the Pi as in step 3 (using its new name)
and run:

```bash
sudo ~/BirdNET-Pi/scripts/set_web_ui_password.sh
```

After 20 wrong tries, sign-in makes you wait.

**No birds after a day.** Check **Health → Audio input**, then repeat step 6.

## Running the station

**Updates** install themselves overnight when **Health → Updates → Install automatically** is
on. With it off, Health shows when one is ready.

**Backups:** **Health → Backups → Download a backup**.

**Uninstall:**

```bash
/usr/local/bin/uninstall.sh && cd ~ && rm -drf BirdNET-Pi
```

### Making a station public

> [!CAUTION]
> **A public station is a public microphone.**
> - Visitors can play one clip per species, real audio from wherever your mic is. Every other
>   recording and the live stream need sign-in.
> - Each public clip is checked for a human voice first, but a faint voice can get through: in
>   testing the check caught every voice 10 dB quieter than the bird, about 60% at 20 dB quieter,
>   and few at 30 dB quieter. It listens only for voices.
> - The recording filter drops audio when BirdNET hears a human sound among its top guesses.
>   **Privacy threshold** (**Settings → Detection**, 0–3) makes it stricter.
> - Recording laws vary by place. Check yours. This is not legal advice.
> - Public pages never show your coordinates, but they do show the station name.

The station serves port 80 on your network. To put it on the internet, run a tunnel or reverse
proxy on the Pi itself, such as `cloudflared`, then let the web UI trust it:

```bash
sudo systemctl edit birdnet_web_ui.service
```

```ini
[Service]
Environment=WEB_UI_TRUSTED_PROXY=1
```
