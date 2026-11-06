#!/usr/bin/env bash

if [ "$EUID" == 0 ]
  then echo "Please run as a non-root user."
  exit
fi

if [ "$(uname -m)" != "aarch64" ] && [ "$(uname -m)" != "x86_64" ];then
  echo "Songbook requires a 64-bit OS.
It looks like your operating system is using $(uname -m),
but would need to be aarch64."
  exit 1
fi

PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info[0]}{sys.version_info[1]}')")
if [ "${PY_VERSION}" == "39" ] ;then
  echo "Songbook requires a newer OS. Please use Raspberry Pi OS Trixie."
  exit 1
fi

# we require passwordless sudo
sudo -K
if ! sudo -n true; then
    echo "Passwordless sudo is not working. Aborting"
    exit
fi

# Simple new installer
HOME=$HOME
USER=$USER

export HOME=$HOME
export USER=$USER

PACKAGES_MISSING=
for cmd in git jq curl ; do
  if ! which $cmd &> /dev/null;then
      PACKAGES_MISSING="${PACKAGES_MISSING} $cmd"
  fi
done
if [[ ! -z $PACKAGES_MISSING ]] ; then
  sudo apt update
  sudo apt -y install $PACKAGES_MISSING
fi

REPO=${BIRDNET_REPO:-CalebLovell/Songbook}
# The newest release, so the station starts on the same version the updater
# would bring it to; main only while the project has no releases yet.
branch=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | jq -r '.tag_name // empty')
branch=${branch:-main}
git clone -b $branch --depth=1 https://github.com/${REPO}.git ${HOME}/BirdNET-Pi &&

$HOME/BirdNET-Pi/scripts/install_birdnet.sh
if [ ${PIPESTATUS[0]} -eq 0 ];then
  echo "Installation completed successfully"
  if awk -F= '/^LATITUDE=/{lat=$2} /^LONGITUDE=/{lon=$2} END{exit !(lat+0==0 && lon+0==0)}' /etc/birdnet/birdnet.conf; then
    echo
    echo "*** The station's location could not be set. ***"
    echo "Until it is, BirdNET will drop most detections."
    echo "After the reboot, sign in to the web UI and set it in Settings -> Station."
    echo
    sleep 10
  fi
  sudo reboot
else
  echo "The installation exited unsuccessfully."
  exit 1
fi
