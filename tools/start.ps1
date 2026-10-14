# Start Hollowmoon Hill, all hidden: a private Ollama on one GPU (port 11445), the Kokoro voice service (8834) and
# the game server (port 8830).
#   powershell -ExecutionPolicy Bypass -File tools\start.ps1
# The machine-wide Ollama (11434) crashes while detecting GPUs when it loads a new model (seen 2026-10-13), so the
# game uses its own instance pinned to one card. Models: qwen3:8b (NPC chat) and qwen3-vl:8b-instruct (photo booth).
$root = Split-Path $PSScriptRoot -Parent
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
$node = 'C:\Users\Yorha\scoop\apps\nodejs-lts\24.18.1\node.exe'  # has an inbound firewall rule; no prompt on bind
New-Item -ItemType Directory -Force (Join-Path $root '.tmp') | Out-Null

function Listening($port) { [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) }

if (-not (Listening 11445)) {
  $env:CUDA_VISIBLE_DEVICES = '1'
  $env:OLLAMA_HOST = '127.0.0.1:11445'
  $env:OLLAMA_NUM_PARALLEL = '8'  # about 20 players talking to NPCs at the same time
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardError (Join-Path $root '.tmp\ollama-game.log')
  Remove-Item Env:CUDA_VISIBLE_DEVICES, Env:OLLAMA_HOST, Env:OLLAMA_NUM_PARALLEL
  Start-Sleep 4
}
if (-not (Listening 8834)) {
  # NPC voices: Kokoro on the same GPU as Ollama (it needs well under 1 GB)
  $env:CUDA_VISIBLE_DEVICES = '1'
  Start-Process -FilePath (Join-Path $root 'tts\.venv\Scripts\python.exe') -ArgumentList 'server.py' -WorkingDirectory (Join-Path $root 'tts') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.tmp\tts.log') -RedirectStandardError (Join-Path $root '.tmp\tts.err.log')
  Remove-Item Env:CUDA_VISIBLE_DEVICES
  Start-Sleep 6
}
if (-not (Listening 8830)) {
  $env:HOST = '0.0.0.0'
  $env:PORT = '8830'
  Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.tmp\server.log') -RedirectStandardError (Join-Path $root '.tmp\server.err.log')
  Start-Sleep 2
}
Invoke-RestMethod http://127.0.0.1:8830/api/health
