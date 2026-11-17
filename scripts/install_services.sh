#!/usr/bin/env bash
# This installs the services that have been selected
set -x # Uncomment to enable debugging
trap 'rm -f ${tmpfile}' EXIT
trap 'exit 1' SIGINT SIGHUP
tmpfile=$(mktemp)

config_file=$my_dir/birdnet.conf
export USER=$USER
export HOME=$HOME

export PYTHON_VIRTUAL_ENV="$HOME/BirdNET-Pi/birdnet/bin/python3"

install_depends() {
  apt -qqq update && apt -qqy upgrade
  echo "icecast2 icecast2/icecast-setup boolean false" | debconf-set-selections
  apt install --no-install-recommends -qqy sqlite3 icecast2 \
    pulseaudio avahi-daemon avahi-utils sox libsox-fmt-mp3 alsa-utils ffmpeg \
    wget curl unzip bc jq openssh-client xz-utils \
    python3-pip python3-venv lsof net-tools inotify-tools
}

# Every station answers at songbook.local. If another device on the network
# already does, this one takes songbook-2, and so on, so the name never moves
# between Pis. avahi follows the address as DHCP changes it.
set_hostname() {
  local name=songbook n=1 found own
  own=" $(hostname -I) "
  systemctl enable --now avahi-daemon.service
  while true; do
    found=$(timeout 5 avahi-resolve -4 -n "$name.local" 2>/dev/null | awk '{print $2}')
    if [ -z "$found" ] || [[ "$own" == *" $found "* ]]; then
      break
    fi
    n=$((n + 1))
    name=songbook-$n
  done
  hostnamectl set-hostname "$name"
  if grep -q '^127\.0\.1\.1' /etc/hosts; then
    sed -i "s/^127\.0\.1\.1[[:space:]].*/127.0.1.1\t$name/" /etc/hosts
  else
    printf '127.0.1.1\t%s\n' "$name" >> /etc/hosts
  fi
  # cloud-init rewrites the hostname and /etc/hosts from this file on boot.
  if [ -f /boot/firmware/user-data ]; then
    sed -i "s/^hostname:.*/hostname: $name/" /boot/firmware/user-data
  fi
  systemctl restart avahi-daemon.service
}

install_scripts() {
  ln -sf ${my_dir}/scripts/* /usr/local/bin/
}

install_birdnet_analysis() {
  cat << EOF > $HOME/BirdNET-Pi/templates/birdnet_analysis.service
[Unit]
Description=BirdNET Analysis
[Service]
Restart=always
Type=simple
RestartSec=2
User=${USER}
ExecStart=$PYTHON_VIRTUAL_ENV /usr/local/bin/birdnet_analysis.py
[Install]
WantedBy=multi-user.target
EOF
  ln -sf $HOME/BirdNET-Pi/templates/birdnet_analysis.service /usr/lib/systemd/system
  systemctl enable birdnet_analysis.service
}

create_necessary_dirs() {
  echo "Creating necessary directories"
  [ -d ${EXTRACTED} ] || sudo -u ${USER} mkdir -p ${EXTRACTED}
  [ -d ${EXTRACTED}/By_Date ] || sudo -u ${USER} mkdir -p ${EXTRACTED}/By_Date
  [ -d ${EXTRACTED}/Charts ] || sudo -u ${USER} mkdir -p ${EXTRACTED}/Charts
  [ -d ${PROCESSED} ] || sudo -u ${USER} mkdir -p ${PROCESSED}
  [ -d $RECS_DIR/StreamData ] || sudo -u ${USER} mkdir -p $RECS_DIR/StreamData

  sudo -u ${USER} ln -fs $my_dir/exclude_species_list.txt $my_dir/scripts
  sudo -u ${USER} ln -fs $my_dir/confirmed_species_list.txt $my_dir/scripts
  sudo -u ${USER} ln -fs $my_dir/include_species_list.txt $my_dir/scripts
  sudo -u ${USER} ln -fs $my_dir/whitelist_species_list.txt $my_dir/scripts
  sudo -u ${USER} ln -sf $my_dir/model/labels_nm/labels_en.txt $my_dir/model/labels_flickr.txt
  chmod -R g+rw $my_dir
  chmod -R g+rw ${RECS_DIR}
}

generate_BirdDB() {
  echo "Generating BirdDB.txt"
  if ! [ -f $my_dir/BirdDB.txt ];then
    sudo -u ${USER} touch $my_dir/BirdDB.txt
    echo "Date;Time;Sci_Name;Com_Name;Confidence;Lat;Lon;Cutoff;Week;Sens;Overlap" | sudo -u ${USER} tee -a $my_dir/BirdDB.txt
  elif ! grep Date $my_dir/BirdDB.txt;then
    sudo -u ${USER} sed -i '1 i\Date;Time;Sci_Name;Com_Name;Confidence;Lat;Lon;Cutoff;Week;Sens;Overlap' $my_dir/BirdDB.txt
  fi
  chown $USER:$USER ${my_dir}/BirdDB.txt && chmod g+rw ${my_dir}/BirdDB.txt
}

set_login() {
  if ! [ -d /etc/lightdm ];then
    systemctl set-default multi-user.target
    ln -fs /lib/systemd/system/getty@.service /etc/systemd/system/getty.target.wants/getty@tty1.service
    if ! [ -d /etc/systemd/system/getty@tty1.service.d ];then
      mkdir /etc/systemd/system/getty@tty1.service.d
    fi
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER --noclear %I \$TERM
EOF
  fi
}

install_recording_service() {
  echo "Installing birdnet_recording.service"
  cat << EOF > $HOME/BirdNET-Pi/templates/birdnet_recording.service
[Unit]
Description=BirdNET Recording
[Service]
Restart=always
Type=simple
RestartSec=3
User=${USER}
ExecStart=/usr/local/bin/birdnet_recording.sh
[Install]
WantedBy=multi-user.target
EOF
  ln -sf $HOME/BirdNET-Pi/templates/birdnet_recording.service /usr/lib/systemd/system
  systemctl enable birdnet_recording.service
}

install_custom_recording_service() {
  echo "Installing custom_recording.service"
  cat << EOF > $HOME/BirdNET-Pi/templates/custom_recording.service
[Unit]
Description=BirdNET Custom Recording
[Service]
Restart=always
Type=simple
RestartSec=3
User=${USER}
ExecStart=/usr/local/bin/custom_recording.sh
[Install]
WantedBy=multi-user.target
EOF
  ln -sf $HOME/BirdNET-Pi/templates/custom_recording.service /usr/lib/systemd/system
}

config_icecast() {
  if [ -f /etc/icecast2/icecast.xml ];then
    cp /etc/icecast2/icecast.xml{,.prebirdnetpi}
  fi
  sed -i 's/>admin</>birdnet</g' /etc/icecast2/icecast.xml
  passwords=("source-" "relay-" "admin-" "master-" "")
  for i in "${passwords[@]}";do
  sed -i "s/<${i}password>.*<\/${i}password>/<${i}password>${ICE_PWD}<\/${i}password>/g" /etc/icecast2/icecast.xml
  done
  sed -i 's|<!-- <bind-address>.*|<bind-address>127.0.0.1</bind-address>|;s|<!-- <shoutcast-mount>.*|<shoutcast-mount>/stream</shoutcast-mount>|' /etc/icecast2/icecast.xml

  systemctl enable icecast2.service
}

install_livestream_service() {
  cat << EOF > $HOME/BirdNET-Pi/templates/livestream.service
[Unit]
Description=BirdNET-Pi Live Stream
After=network-online.target
Requires=network-online.target
[Service]
Restart=always
Type=simple
RestartSec=3
User=${USER}
ExecStart=/usr/local/bin/livestream.sh
[Install]
WantedBy=multi-user.target
EOF
  ln -sf $HOME/BirdNET-Pi/templates/livestream.service /usr/lib/systemd/system
  systemctl enable livestream.service
}

install_cleanup_cron() {
  sed "s/\$USER/$USER/g" $my_dir/templates/cleanup.cron >> /etc/crontab
}

chown_things() {
  chown -R $USER:$USER $HOME/Bird*
}

install_services() {
  set_login
  install_tmp_mount

  install_depends
  set_hostname
  install_scripts
  install_birdnet_analysis
  install_recording_service
  install_custom_recording_service # But does not enable
  install_livestream_service
  install_birdnet_mount
  # Chunks live in RAM, sparing the SD card ~17 GB of writes a day.
  systemctl enable "$(systemd-escape -p --suffix=mount "$RECS_DIR/StreamData")"
  install_cleanup_cron

  create_necessary_dirs
  generate_BirdDB
  config_icecast
  USER=$USER HOME=$HOME ${my_dir}/scripts/createdb.sh
  # The web UI, its service and the nightly update timer.
  ${my_dir}/scripts/install_web_ui.sh
}

if [ -f ${config_file} ];then
  source ${config_file}
  source install_helpers.sh
  install_services
  chown_things
else
  echo "Unable to find a configuration file. Please make sure that $config_file exists."
fi
