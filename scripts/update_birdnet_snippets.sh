#!/usr/bin/env bash
# Run as root by update_birdnet.sh once the code is on the new release: brings
# what lives outside the checkout in line with it. A failure rolls the update
# back. Safe to run again.
set -x
trap 'exit 1' SIGINT SIGHUP
source /etc/birdnet/birdnet.conf
USER=${BIRDNET_USER}
HOME=/home/${BIRDNET_USER}

sudo -u "$USER" "$HOME/BirdNET-Pi/birdnet/bin/pip3" install -q -r "$HOME/BirdNET-Pi/requirements.txt" || exit 1

# Scripts deleted from the repository leave dangling links behind.
find /usr/local/bin -maxdepth 1 -xtype l -lname "$HOME/BirdNET-Pi/scripts/*" -delete

sed -i '/birdnet/,+1d' /etc/crontab
sed "s/\$USER/$USER/g" "$HOME/BirdNET-Pi/templates/cleanup.cron" >> /etc/crontab

# The web UI, its service and the update timer, so a release that changes their
# unit files gets them rewritten.
"$HOME/BirdNET-Pi/scripts/install_web_ui.sh" || exit 1

systemctl daemon-reload
restart_services.sh
