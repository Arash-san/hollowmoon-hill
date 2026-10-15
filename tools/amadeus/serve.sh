#!/usr/bin/env bash
# Runs INSIDE the GPU container (launch.sh starts it): Qwen3.8 27B FP8 with vLLM, OpenAI API on :8850.
# The container's address goes to ./endpoint so proxy.py on the host can expose it on the tailnet.
set -euo pipefail
cd /workspace/hollowmoon-llm
hostname -I | awk '{print $1}' > endpoint
# No JIT kernels: the image has no CUDA toolkit (and the venv's pip nvcc does not match its headers)
export VLLM_USE_DEEP_GEMM=0 VLLM_USE_FLASHINFER_SAMPLER=0
export HF_HOME=/workspace/hf HF_HUB_OFFLINE=1 CUDA_VISIBLE_DEVICES=0
export VLLM_API_KEY="$(cat api_key)"
exec /workspace/hip_amadeus/venv/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen3.8-27B-FP8 --served-model-name hollowmoon \
  --host 0.0.0.0 --port 8850 \
  --max-model-len 16384 --max-num-seqs 48 \
  --gpu-memory-utilization "${GPU_UTIL:-0.32}" \
  --reasoning-parser qwen3 \
  --speculative-config '{"method":"mtp","num_speculative_tokens":2}' \
  --limit-mm-per-prompt '{"image":1,"video":0}' \
  --disable-uvicorn-access-log
