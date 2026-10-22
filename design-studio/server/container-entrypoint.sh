#!/bin/sh
set -eu

# Mounted volumes may initially belong to root. Fix only the selected data
# directory, then run both the web server and its FFmpeg children unprivileged.
export DATA_DIR="${DATA_DIR:-/app/data}"
data_path="$(realpath -m -- "$DATA_DIR")"
case "$data_path" in
  /|/app|/etc|/usr|/var|/home|/tmp|/proc|/sys|/dev)
    echo 'DATA_DIR must be a dedicated data directory, such as /app/data.' >&2
    exit 1
    ;;
esac
if [ "$(id -u)" = '0' ]; then
  mkdir -p -- "$DATA_DIR"
  chown -R node:node -- "$DATA_DIR"
  chmod 700 -- "$DATA_DIR"
  exec gosu node "$@"
fi
exec "$@"
