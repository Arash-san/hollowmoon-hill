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

# Pick the RTX 5090 with the most free memory (lab jobs move around after a reboot). Index is in nvidia-smi
# (PCI bus) order, so CUDA_DEVICE_ORDER must be PCI_BUS_ID. Override with $env:HH_GPU.
$gpu = $env:HH_GPU
if (-not $gpu) {
  $gpu = (nvidia-smi --query-gpu=index,name,memory.free --format=csv,noheader,nounits | ForEach-Object {
      $i, $n, $f = $_ -split ',\s*'; if ($n -match '5090') { [pscustomobject]@{ i = $i; free = [int]$f } } } |
    Sort-Object free -Descending | Select-Object -First 1).i
}
Write-Host "Using GPU $gpu"
$env:CUDA_DEVICE_ORDER = 'PCI_BUS_ID'

if (-not (Listening 11445)) {
  $env:CUDA_VISIBLE_DEVICES = $gpu
  $env:OLLAMA_HOST = '127.0.0.1:11445'
  $env:OLLAMA_NUM_PARALLEL = '8'  # about 20 players talking to NPCs at the same time
  # Ollama 0.40 turns Vulkan on, which ignores CUDA_VISIBLE_DEVICES and can land on any (busy) card at ~12 tok/s
  $env:OLLAMA_VULKAN = '0'
  $env:OLLAMA_CONTEXT_LENGTH = '4096'  # requests without num_ctx would otherwise load a 60 GB context
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardError (Join-Path $root '.tmp\ollama-game.log')
  Remove-Item Env:CUDA_VISIBLE_DEVICES, Env:OLLAMA_HOST, Env:OLLAMA_NUM_PARALLEL, Env:OLLAMA_VULKAN, Env:OLLAMA_CONTEXT_LENGTH
  Start-Sleep 4
}
if (-not (Listening 8834)) {
  # NPC voices: Kokoro on the same GPU as Ollama (it needs well under 1 GB)
  $env:CUDA_VISIBLE_DEVICES = $gpu
  Start-Process -FilePath (Join-Path $root 'tts\.venv\Scripts\python.exe') -ArgumentList 'server.py' -WorkingDirectory (Join-Path $root 'tts') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.tmp\tts.log') -RedirectStandardError (Join-Path $root '.tmp\tts.err.log')
  Remove-Item Env:CUDA_VISIBLE_DEVICES
  Start-Sleep 6
}
Remove-Item Env:CUDA_DEVICE_ORDER
if (-not (Listening 8830)) {
  $env:HOST = '0.0.0.0'
  $env:PORT = '8830'
  Start-Process -FilePath $node -ArgumentList 'server/index.js' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root '.tmp\server.log') -RedirectStandardError (Join-Path $root '.tmp\server.err.log')
  Start-Sleep 2
}
Invoke-RestMethod http://127.0.0.1:8830/api/health
