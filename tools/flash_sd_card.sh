#!/usr/bin/env bash
# Writes Raspberry Pi OS Lite (64-bit) to a microSD card and preconfigures it with
# cloud-init, so the Pi joins the network and accepts SSH on first boot with no screen
# or keyboard. Runs on a Linux computer as your normal user; sudo is asked for only to
# write the card. Secrets (the Wi-Fi password, sudo) are typed at the terminal, never
# passed as arguments.
set -euo pipefail

OS_LIST=https://downloads.raspberrypi.com/os_list_imagingutility_v4.json
CACHE_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/songbook
MAX_CARD_BYTES=$((512 * 1024 * 1024 * 1024))

usage() {
  cat <<EOF
Usage: $0 --device /dev/sdX --hostname NAME [options]

  --device PATH      the card to erase, e.g. /dev/mmcblk0 or /dev/sdb (required)
  --hostname NAME    the Pi's network name; it becomes http://NAME.local (required)
  --user NAME        the Pi's login user (default: $USER)
  --ssh-key FILE     public key allowed to log in (default: ~/.ssh/id_ed25519.pub or id_rsa.pub)
  --wifi SSID        Wi-Fi network to join; the password is asked for at the terminal
  --country CODE     Wi-Fi country, e.g. US or GB (required with --wifi)
  --timezone ZONE    e.g. America/Chicago (default: this computer's)
  --image FILE       an already downloaded .img to write instead of the newest Lite image

The card is erased only after you type yes at the terminal.
EOF
}

die() { echo "$*" >&2; exit 1; }

yaml_quoted() {
  local value=${1//\\/\\\\}
  printf '"%s"' "${value//\"/\\\"}"
}

device= hostname= user=$USER ssh_key= ssid= country= image=
timezone=$(timedatectl show --value --property=Timezone 2>/dev/null || true)

while [ $# -gt 0 ]; do
  case $1 in
    --device) device=$2; shift 2 ;;
    --hostname) hostname=$2; shift 2 ;;
    --user) user=$2; shift 2 ;;
    --ssh-key) ssh_key=$2; shift 2 ;;
    --wifi) ssid=$2; shift 2 ;;
    --country) country=$2; shift 2 ;;
    --timezone) timezone=$2; shift 2 ;;
    --image) image=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

[ "$(uname -s)" = Linux ] || die "This script runs on Linux. On macOS or Windows, use Raspberry Pi Imager."
[ -n "$device" ] && [ -n "$hostname" ] || { usage >&2; exit 1; }
[[ $hostname =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] \
  || die "Hostname must be lowercase letters, digits and hyphens."
[ -z "$ssid" ] || [ -n "$country" ] || die "--country is needed with --wifi."
[ -n "$timezone" ] || die "Couldn't read this computer's time zone; pass --timezone."
for cmd in curl python3 xz sha256sum lsblk dd partprobe; do
  command -v "$cmd" >/dev/null || die "Missing $cmd."
done

if [ -z "$ssh_key" ]; then
  for candidate in "$HOME/.ssh/id_ed25519.pub" "$HOME/.ssh/id_rsa.pub"; do
    [ -f "$candidate" ] && { ssh_key=$candidate; break; }
  done
fi
[ -f "$ssh_key" ] || die "No SSH public key found. Make one with: ssh-keygen -t ed25519"
pubkey=$(cat "$ssh_key")

[ -b "$device" ] || die "$device is not a disk."
[ "$(lsblk -dno TYPE "$device")" = disk ] || die "$device is a partition; pass the whole card."
if lsblk -no MOUNTPOINTS "$device" | grep -qxE '/|/boot.*|/home.*|/usr.*|/var.*|\[SWAP\]'; then
  die "$device holds this computer's system. Refusing."
fi
size=$(lsblk -dbno SIZE "$device")
[ "$size" -le "$MAX_CARD_BYTES" ] || die "$device is larger than any SD card should be. Refusing."

if [ -z "$image" ]; then
  echo "Looking up the newest Raspberry Pi OS Lite (64-bit)…"
  read -r url sha < <(curl -fsSL "$OS_LIST" | python3 -I -c '
import json, sys
def walk(items):
    for item in items:
        if "subitems" in item:
            yield from walk(item["subitems"])
        elif item.get("name") == "Raspberry Pi OS Lite (64-bit)":
            yield item
found = next(walk(json.load(sys.stdin)["os_list"]))
print(found["url"], found["extract_sha256"])
') || true
  [ -n "${url:-}" ] && [ -n "${sha:-}" ] || die "Couldn't look up the newest image. Check the internet connection."
  mkdir -p "$CACHE_DIR"
  image=$CACHE_DIR/$(basename "$url" .xz)
  if [ ! -f "$image" ] || ! echo "$sha  $image" | sha256sum -c --status; then
    echo "Downloading $(basename "$url")…"
    curl -fL --progress-bar -o "$image.xz" "$url"
    xz -df "$image.xz"
    echo "$sha  $image" | sha256sum -c --status || die "The download doesn't match its checksum."
  fi
  echo "Image verified: $(basename "$image")"
fi
[ -f "$image" ] || die "No image at $image."

wifi_pass=
if [ -n "$ssid" ]; then
  read -rsp "Wi-Fi password for $ssid: " wifi_pass </dev/tty; echo
fi

echo
lsblk -o NAME,SIZE,MODEL,MOUNTPOINTS "$device"
read -rp "Erase $device and write $(basename "$image")? Type yes: " answer </dev/tty
[ "$answer" = yes ] || die "Stopped. Nothing was written."

for part in $(lsblk -lnpo NAME "$device" | tail -n +2); do
  udisksctl unmount -b "$part" >/dev/null 2>&1 || sudo umount "$part" 2>/dev/null || true
done

sudo dd if="$image" of="$device" bs=4M conv=fsync status=progress
sudo partprobe "$device"
sleep 2

boot_part=$(lsblk -lnpo NAME,LABEL "$device" | awk '$2=="bootfs"{print $1}')
[ -n "$boot_part" ] || die "Wrote the image, but found no boot partition on $device."
mnt=$(mktemp -d)
sudo mount "$boot_part" "$mnt"
trap 'sudo umount "$mnt" 2>/dev/null; rmdir "$mnt"' EXIT

sudo tee "$mnt/user-data" >/dev/null <<EOF
#cloud-config
hostname: $hostname
manage_etc_hosts: true
timezone: $timezone
users:
  - name: $user
    groups: users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo
    shell: /bin/bash
    lock_passwd: true
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - $pubkey
enable_ssh: true
ssh_pwauth: false
runcmd:
  - [systemctl, enable, --now, ssh]
EOF
if [ -n "$country" ]; then
  sudo sed -i "/^runcmd:/a\\  - [raspi-config, nonint, do_wifi_country, \"$country\"]" "$mnt/user-data"
fi
sudo touch "$mnt/ssh"

if [ -n "$ssid" ]; then
  sudo tee "$mnt/network-config" >/dev/null <<EOF
network:
  version: 2
  wifis:
    renderer: NetworkManager
    wlan0:
      dhcp4: true
      regulatory-domain: "$country"
      access-points:
        $(yaml_quoted "$ssid"):
          password: $(yaml_quoted "$wifi_pass")
      optional: true
EOF
fi

sync
echo
echo "The card is ready. Put it in the Pi, plug in the USB microphone, then power on."
echo "In 2-4 minutes it should answer: ssh $user@$hostname.local"
