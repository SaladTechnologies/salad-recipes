import { z } from "zod";
import config from "../config";

let checkpoint: any = config.models.checkpoints.enum.optional();
if (config.warmupCkpt) {
  checkpoint = checkpoint.default(config.warmupCkpt);
}

const ComfyNodeSchema = z.object({
  inputs: z.any(),
  class_type: z.string(),
  _meta: z.any().optional(),
});

type ComfyNode = z.infer<typeof ComfyNodeSchema>;

interface Workflow {
  RequestSchema: z.ZodObject<any, any>;
  generateWorkflow: (input: any) => Record<string, ComfyNode>;
  description?: string;
  summary?: string;
}

const RequestSchema = z.object({
  prompt: z.string().describe("The positive prompt for image generation"),
  width: z
    .number()
    .int()
    .min(256)
    .max(2048)
    .optional()
    .default(1024)
    .describe("Width of the generated image"),
  height: z
    .number()
    .int()
    .min(256)
    .max(2048)
    .optional()
    .default(1024)
    .describe("Height of the generated image"),
  seed: z
    .number()
    .int()
    .optional()
    .default(() => Math.floor(Math.random() * 1000000000000000))
    .describe("Seed for random number generation"),
  steps: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Number of sampling steps"),
  cfg_scale: z
    .number()
    .min(0)
    .max(20)
    .optional()
    .default(4.5)
    .describe("Classifier-free guidance scale"),
  sampler_name: config.samplers
    .optional()
    .default("dpmpp_2m")
    .describe("Name of the sampler to use"),
  scheduler: config.schedulers
    .optional()
    .default("sgm_uniform")
    .describe("Type of scheduler to use"),
  denoise: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(1)
    .describe("Denoising strength"),
  checkpoint,
});

type InputType = z.infer<typeof RequestSchema>;

function generateWorkflow(input: InputType): Record<string, ComfyNode> {
  return {
    "4": {
      inputs: {
        ckpt_name: input.checkpoint,
      },
      class_type: "CheckpointLoaderSimple",
      _meta: {
        title: "Load Checkpoint",
      },
    },
    "6": {
      inputs: {
        text: input.prompt,
        clip: ["11", 0],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Prompt)",
      },
    },
    "8": {
      inputs: {
        samples: ["294", 0],
        vae: ["4", 2],
      },
      class_type: "VAEDecode",
      _meta: {
        title: "VAE Decode",
      },
    },
    "11": {
      inputs: {
        clip_name1: "clip_g.safetensors",
        clip_name2: "clip_l.safetensors",
        clip_name3: "t5xxl_fp8_e4m3fn.safetensors",
      },
      class_type: "TripleCLIPLoader",
      _meta: {
        title: "TripleCLIPLoader",
      },
    },
    "13": {
      inputs: {
        shift: 3,
        model: ["4", 0],
      },
      class_type: "ModelSamplingSD3",
      _meta: {
        title: "ModelSamplingSD3",
      },
    },
    "67": {
      inputs: {
        conditioning: ["71", 0],
      },
      class_type: "ConditioningZeroOut",
      _meta: {
        title: "ConditioningZeroOut",
      },
    },
    "68": {
      inputs: {
        start: 0.1,
        end: 1,
        conditioning: ["67", 0],
      },
      class_type: "ConditioningSetTimestepRange",
      _meta: {
        title: "ConditioningSetTimestepRange",
      },
    },
    "69": {
      inputs: {
        conditioning_1: ["68", 0],
        conditioning_2: ["70", 0],
      },
      class_type: "ConditioningCombine",
      _meta: {
        title: "Conditioning (Combine)",
      },
    },
    "70": {
      inputs: {
        start: 0,
        end: 0.1,
        conditioning: ["71", 0],
      },
      class_type: "ConditioningSetTimestepRange",
      _meta: {
        title: "ConditioningSetTimestepRange",
      },
    },
    "71": {
      inputs: {
        text: "",
        clip: ["11", 0],
      },
      class_type: "CLIPTextEncode",
      _meta: {
        title: "CLIP Text Encode (Prompt)",
      },
    },
    "135": {
      inputs: {
        width: input.width,
        height: input.height,
        batch_size: 1,
      },
      class_type: "EmptySD3LatentImage",
      _meta: {
        title: "EmptySD3LatentImage",
      },
    },
    "294": {
      inputs: {
        seed: input.seed,
        steps: input.steps,
        cfg: input.cfg_scale,
        sampler_name: input.sampler_name,
        scheduler: input.scheduler,
        denoise: input.denoise,
        model: ["13", 0],
        positive: ["6", 0],
        negative: ["69", 0],
        latent_image: ["135", 0],
      },
      class_type: "KSampler",
      _meta: {
        title: "KSampler",
      },
    },
    "301": {
      inputs: {
        filename_prefix: "ComfyUI",
        images: ["8", 0],
      },
      class_type: "SaveImage",
      _meta: {
        title: "Save Image",
      },
    },
  };
}

const workflow: Workflow = {
  RequestSchema,
  generateWorkflow,
};

export default workflow;
