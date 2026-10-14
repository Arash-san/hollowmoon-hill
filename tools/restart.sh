#!/usr/bin/env bash
# Restart the local game server (port 8830) in the background, logging to .tmp/server.log.
cd "$(dirname "$0")/.."
PORT=${PORT:-8830}
for pid in $(netstat -ano | grep -E "[:.]$PORT\s.*LISTENING" | awk '{print $NF}' | sort -u); do taskkill //PID "$pid" //F >/dev/null 2>&1; done
sleep 0.5
NODE="${NODE:-/c/Users/Yorha/scoop/apps/nodejs-lts/24.18.1/node.exe}"  # this exe has a firewall allow rule
nohup env HOST=${HOST:-0.0.0.0} PORT=$PORT "$NODE" server/index.js > .tmp/server.log 2>&1 &
sleep 1.5
tail -3 .tmp/server.log
