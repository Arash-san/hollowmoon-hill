#!/usr/bin/env bash
# cron (*/5 and @reboot): keep the tailnet relay and the vLLM container up. Starts things only; never stops anything.
cd "$(dirname "$0")"
pgrep -u "$(id -u)" -f 'hollowmoon-llm/proxy.py' >/dev/null || setsid nohup python3 "$PWD/proxy.py" > proxy.log 2>&1 < /dev/null &
key="$(cat api_key)"
if [ -f endpoint ] && curl -s -m 3 -H "Authorization: Bearer $key" "http://$(cat endpoint):8850/v1/models" | grep -q hollowmoon; then exit 0; fi
pgrep -u "$(id -u)" -f 'hollowmoon-llm/launch.sh' >/dev/null && exit 0  # still loading
free=$(nvidia-smi --id=1 --query-gpu=memory.free --format=csv,noheader,nounits)
if [ "$free" -lt 50000 ]; then echo "$(date -Is) GPU 1 has only ${free} MiB free, not starting" >> ensure.log; exit 0; fi
echo "$(date -Is) starting (GPU 1 free ${free} MiB)" >> ensure.log
rm -f endpoint
setsid nohup bash "$PWD/launch.sh" > serve.log 2>&1 < /dev/null &
