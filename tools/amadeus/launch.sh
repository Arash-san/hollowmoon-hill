#!/usr/bin/env bash
# Start serve.sh in a GPU container on H200 #1, the same way the HIP worker runs outside Slurm
# (lab-gpu-guard then holds a placeholder job for the card). It shares the card with other jobs: ~46 GB slice.
export SLURM_JOB_ID=hollowmoon CUDA_VISIBLE_DEVICES=1
exec sudo -n /usr/local/sbin/gpu-docker-launch -- bash /workspace/hollowmoon-llm/serve.sh
