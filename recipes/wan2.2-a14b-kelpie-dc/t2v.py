import time
import torch
import argparse
import os, uuid, json, random, sys
from diffusers import WanPipeline, AutoencoderKLWan
from diffusers.utils import export_to_video
from dfloat11 import DFloat11Model

parser = argparse.ArgumentParser(description='Run Wan2.2 T2V model with custom parameters')
parser.add_argument("--id", default=None, help="(Optional) Unique job ID (default: random UUID4)")
parser.add_argument('--prompt', type=str, default="A serene koi pond at night, with glowing lanterns reflecting on the rippling water. Ethereal fireflies dance above as cherry blossoms gently fall, creating a dreamlike atmosphere.",
                    help='Text prompt for video generation')
parser.add_argument('--negative_prompt', type=str, default="色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
                    help='Negative prompt for video generation')
parser.add_argument('--width', type=int, default=1280, help='Width of output video')
parser.add_argument('--height', type=int, default=720, help='Height of output video')
parser.add_argument('--num_frames', type=int, default=81, help='Number of frames to generate')
parser.add_argument('--guidance_scale', type=float, default=4.0, help='Guidance scale for first stage')
parser.add_argument('--guidance_scale_2', type=float, default=3.0, help='Guidance scale for second stage')
parser.add_argument('--num_inference_steps', type=int, default=40, help='Number of inference steps')
parser.add_argument('--cpu_offload', action='store_true', help='Enable CPU offloading')
parser.add_argument('--output', type=str, default=None, help='Output video file path')
parser.add_argument('--fps', type=int, default=16, help='FPS of output video')

args = parser.parse_args()

OUTPUT_ROOT = os.getenv("OUTPUT_ROOT", "/opt/outputs")

# --- Job ID resolution ---
if not args.id:
    args.id = uuid.uuid4().hex
JOB_ID = args.id
print(f"[info] job_id={JOB_ID}")


# Detect if user explicitly provided --output flag
if not args.output:
    # User did not pass --output: derive filename from job id
    args.output = f"{OUTPUT_ROOT}/{JOB_ID}.mp4"

print(f"[info] Final output path: {args.output}")

model_repo = os.getenv("WAN_MAIN_MODEL_DIR", "/opt/hf/Wan2.2-T2V-A14B-Diffusers")
df11_main_repo = os.getenv("WAN_DF11_MAIN_DIR", "/opt/hf/Wan2.2-T2V-A14B-DF11")
df11_stage2_repo = os.getenv("WAN_DF11_STAGE2_DIR", "/opt/hf/Wan2.2-T2V-A14B-2-DF11")

print(f"[info] model_repo={model_repo}")
print(f"[info] dfloat11_main={df11_main_repo}")
print(f"[info] dfloat11_stage2={df11_stage2_repo}")

# --- Load models (replaces hard-coded strings) ---
vae = AutoencoderKLWan.from_pretrained(model_repo, subfolder="vae", torch_dtype=torch.float32)
pipe = WanPipeline.from_pretrained(model_repo, vae=vae, torch_dtype=torch.bfloat16)
# Load DFloat11 models
DFloat11Model.from_pretrained(
    df11_main_repo,
    device="cpu",
    cpu_offload=args.cpu_offload,
    bfloat16_model=pipe.transformer,
)
DFloat11Model.from_pretrained(
    df11_stage2_repo,
    device="cpu",
    cpu_offload=args.cpu_offload,
    bfloat16_model=pipe.transformer_2,
)

pipe.enable_model_cpu_offload()

# Ensure PyTorch CUDA allocator config is set (fallback if not provided by environment)
if "PYTORCH_CUDA_ALLOC_CONF" not in os.environ:
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

start_time = time.time()
# Generate video
output = pipe(
    prompt=args.prompt,
    negative_prompt=args.negative_prompt,
    height=args.height,
    width=args.width,
    num_frames=args.num_frames,
    guidance_scale=args.guidance_scale,
    guidance_scale_2=args.guidance_scale_2,
    num_inference_steps=args.num_inference_steps,
).frames[0]
print(f"Time taken: {time.time() - start_time:.2f} seconds")

export_to_video(output, args.output, fps=args.fps)

# Print memory usage
max_memory = torch.cuda.max_memory_allocated()
print(f"Max memory: {max_memory / (1000 ** 3):.2f} GB")