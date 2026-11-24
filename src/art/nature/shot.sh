#!/bin/sh
# 用法: sh src/art/nature/shot.sh "<url>" out.png W H [scale]   需先 npm run dev
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor="${5:-1}" \
  --virtual-time-budget=4000 --window-size="$3,$4" --screenshot="$2" "$1" >/dev/null 2>&1
