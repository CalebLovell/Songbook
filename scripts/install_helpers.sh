# this should only contain functions and assignments, ie source install.sh should not have side effects.

install_birdnet_mount() {
  TMP_MOUNT=$(systemd-escape -p --suffix=mount "$RECS_DIR/StreamData")
  cat << EOF > $HOME/BirdNET-Pi/templates/$TMP_MOUNT
[Unit]
Description=Birdnet tmpfs for transient files
ConditionPathExists=$RECS_DIR/StreamData
# Mounted before anything opens the folder, or the analysis would watch the
# card underneath it.
Before=birdnet_recording.service custom_recording.service birdnet_analysis.service livestream.service

[Mount]
What=tmpfs
Where=$RECS_DIR/StreamData
Type=tmpfs
# About 20 chunks: if the analysis stalls, recording waits instead of filling
# memory.
Options=mode=1777,nosuid,nodev,size=64M

[Install]
WantedBy=multi-user.target
EOF
  ln -sf $HOME/BirdNET-Pi/templates/$TMP_MOUNT /usr/lib/systemd/system
}

install_tmp_mount() {
  STATE=$(systemctl is-enabled tmp.mount 2>&1 | grep -E '(enabled|disabled|static)')
  ! [ -f /usr/share/systemd/tmp.mount ] && echo "Warning: no /usr/share/systemd/tmp.mount found"
  if [ -z $STATE ]; then
    cp -f /usr/share/systemd/tmp.mount /etc/systemd/system/tmp.mount
    systemctl daemon-reload
    systemctl enable tmp.mount
  else
    echo "tmp.mount is $STATE, skipping"
  fi
}
