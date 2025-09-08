import argparse, json, os, subprocess, sys, pathlib, base64
import requests
import shutil  
import uuid    

WAN_REPO_DIR = "/opt/Wan2.2"
OUT_DIR = "/opt/outputs"
ASSETS_DIR = "/opt/assets"

def prepare_image(args, assets_dir: str) -> str | None:
    """
    Resolve one of (image_b64 | image_url | image_path) in priority order:
      1. --image-b64  (raw or data:*;base64,)
      2. --image-url  (download)
      3. --image-path (local file anywhere)
    For any source, create a file INSIDE assets_dir and return its absolute path.
    On failure, log a warning and return None.
    """
    assets_path = pathlib.Path(assets_dir).resolve()

    # 1. Base64
    if args.image_b64:
        data_part = args.image_b64
        if data_part.startswith("data:") and ";base64," in data_part:
            data_part = data_part.split(";base64,", 1)[1]
        try:
            raw = base64.b64decode(data_part, validate=True)
            out_path = assets_path / f"inline_{args.id}.png"
            with open(out_path, "wb") as f:
                f.write(raw)
            print(f"[worker] prepared base64 image -> {out_path}")
            return str(out_path)
        except Exception as e:
            print(f"[worker][warn] failed decoding --image-b64 (ignored): {e}")

    # 2. URL
    if args.image_url:
        try:
            resp = requests.get(args.image_url, timeout=30)
            resp.raise_for_status()
            ctype = resp.headers.get("Content-Type", "")
            ext = ".jpg"
            if "png" in ctype: ext = ".png"
            elif "webp" in ctype: ext = ".webp"
            elif "gif" in ctype: ext = ".gif"
            elif args.image_url.lower().endswith((".png", ".webp", ".gif", ".jpg", ".jpeg")):
                ext = os.path.splitext(args.image_url)[1]
            out_path = assets_path / f"download_{args.id}{ext}"
            with open(out_path, "wb") as f:
                f.write(resp.content)
            print(f"[worker] downloaded image -> {out_path}")
            return str(out_path)
        except Exception as e:
            print(f"[worker][warn] failed downloading --image-url (ignored): {e}")

    # 3. Local path
    if args.image_path:
        src = pathlib.Path(args.image_path)
        if not src.is_file():
            print(f"[worker][warn] --image-path not a file (ignored): {src}")
            return None
        ext = src.suffix or ".png"
        out_path = assets_path / f"local_{args.id}{ext}"
        try:
            shutil.copy2(src, out_path)
            print(f"[worker] copied local image -> {out_path}")
            return str(out_path)
        except Exception as e:
            print(f"[worker][warn] failed copying --image-path (ignored): {e}")

    return None

def main():
    p = argparse.ArgumentParser()
    # core essentials
    p.add_argument("--id", default=None, help="(Optional) Unique job ID (default: random UUID4)")
    p.add_argument("--size", default="1280*704")
    p.add_argument("--prompt", required=True, help="(Required) Text prompt for generation")  # was optional with default ""
    p.add_argument("--image-path", dest="image_path", default="", help="Local source image (will be copied into assets)")
    p.add_argument("--image-url", dest="image_url", default=None, help="Remote image URL to download into assets")
    p.add_argument("--image-b64", dest="image_b64", default=None, help="Raw/base64 or data URI to decode into assets")
    p.add_argument("--frame-num", dest="frame_num", type=int, default=121)
    p.add_argument("--sample-steps", dest="sample_steps", type=int, default=50)
    p.add_argument("--base-seed", dest="base_seed", type=int, default=None, help="Seed (base) for reproducibility")
    p.add_argument("--sample-solver", dest="sample_solver", choices=["unipc","dpm++"], default=None)
    p.add_argument("--sample-shift", dest="sample_shift", type=float, default=None)
    p.add_argument("--sample-guide-scale", dest="sample_guide_scale", type=float, default=None)
    p.add_argument("--ckpt-dir-local", dest="ckpt_dir_local", default="/opt/Wan2.2-TI2V-5B")
    p.add_argument("--output-filename", dest="output_filename", default=None, help="Base name (no extension) for output video")
    p.add_argument("--extra-args-json", dest="extra_args_json", default="{}", help="Optional JSON for additional generate.py flags")

    args = p.parse_args()
    args.task = "ti2v-5B"  # enforce fixed task
    if not args.id:
        args.id = str(uuid.uuid4())

    print(f"[worker] start job_id={args.id}")
    print(f"[worker] args: task={args.task} size={args.size} frames={args.frame_num} steps={args.sample_steps}")
    print(f"[worker] model_dir={args.ckpt_dir_local}")

    # ensure dirs
    for d in (OUT_DIR, ASSETS_DIR):
        pathlib.Path(d).mkdir(parents=True, exist_ok=True)

    # Prepare image (new unified handling)
    final_image_path = prepare_image(args, ASSETS_DIR)

    # Determine save_file path
    base_name = args.output_filename or args.id
    base_root, _ = os.path.splitext(base_name)
    final_name = base_root + ".mp4"
    save_file = os.path.join(OUT_DIR, final_name)
    print(f"[worker] planned save_file={save_file}")

    # Build base command
    cmd = [
        sys.executable, f"{WAN_REPO_DIR}/generate.py",
        "--task", args.task,
        "--size", args.size,
        "--ckpt_dir", args.ckpt_dir_local,
        "--frame_num", str(args.frame_num),
        "--sample_steps", str(args.sample_steps),
        "--save_file", save_file,
        "--offload_model", "True",   # always enabled
        "--t5_cpu",                  # always place T5 on CPU to lower VRAM
        "--prompt", args.prompt,     # always include 
    ]

    if args.base_seed is not None:
        cmd += ["--base_seed", str(args.base_seed)]
    if args.sample_solver:
        cmd += ["--sample_solver", args.sample_solver]
    if args.sample_shift is not None:
        cmd += ["--sample_shift", str(args.sample_shift)]
    if args.sample_guide_scale is not None:
        cmd += ["--sample_guide_scale", str(args.sample_guide_scale)]

    if final_image_path:
        cmd += ["--image", final_image_path]

    # Optional emergency overrides
    try:
        extra = json.loads(args.extra_args_json)
        for k, v in extra.items():
            flag = f"--{k}"
            if isinstance(v, bool):
                if v:
                    cmd += [flag]
            else:
                cmd += [flag, str(v)]
    except Exception as e:
        print(f"[worker][warn] extra_args_json parse error: {e}", flush=True)

    # Run generate.py (stdout/stderr pass through directly)
    result = subprocess.run(cmd)
    rc = result.returncode
    print(f"[worker] subprocess exit_code={rc}")

    output_exists = os.path.isfile(save_file)
    success = (rc == 0) and output_exists

    if success:
        print(f"[worker] output confirmed at {save_file}")
    else:
        if rc != 0:
            print(f"[worker][warn] process failed (rc={rc}); output may be missing: {save_file}")
        else:
            print(f"[worker][error] process reported success but output missing: {save_file}")
        # If generate.py said OK but file missing, force non-zero exit so Kelpie marks failure
        if rc == 0 and not output_exists:
            rc = 1  # adjust exit code to signal failure

    print(f"[worker] done status={'succeeded' if success else 'failed'} output={'present' if output_exists else 'absent'}")
    sys.exit(rc)

if __name__ == "__main__":
    main()
