import { z } from "zod";
import config from "../config";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";

/** We can derive the default checkpoint by seeing what ran as the warmup */
let checkpoint: any = config.models.checkpoints.enum.optional();
if (config.warmupCkpt) {
  checkpoint = checkpoint.default(config.warmupCkpt);
}

/** We'll need to dynamically download loras to the lora directory */
const loraDir = path.join(config.comfyDir, "models", "loras");

const ComfyNodeSchema = z.object({
  inputs: z.any(),
  class_type: z.string(),
  _meta: z.any().optional(),
});

type ComfyNode = z.infer<typeof ComfyNodeSchema>;

/**
 * All custom workflow endpoints export something that matches this interface,
 * and the workflow name is the filename. This is evaluated at runtime in the context
 * of the comfyui server, so we can use any included node modules we want.
 */
interface Workflow {
  RequestSchema: z.ZodObject<any, any>;
  generateWorkflow: (input: any) => Promise<Record<string, ComfyNode>>;
  description?: string;
  summary?: string;
}

const image_size_obj = z.object({
  width: z.number().int().min(256).max(2048),
  height: z.number().int().min(256).max(2048),
});

const image_size_enum = z.enum([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
]);

const lora_weight = z.object({
  path: z.string().describe("URL or path to the LoRA file"),
  scale: z
    .number()
    .min(0)
    .default(1)
    .describe(
      "The scale of the LoRA weight. This is used to scale the LoRA weight before merging it with the base model."
    ),
});

const RequestSchema = z.object({
  checkpoint,
  prompt: z.string().describe("The text prompt to generate an image from"),
  image_size: z
    .union([image_size_obj, image_size_enum])
    .optional()
    .default("landscape_4_3")
    .describe("The size of the generated image"),
  num_inference_steps: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(28)
    .describe("The number of inference steps to perform."),
  seed: z
    .number()
    .int()
    .optional()
    .default(() => Math.floor(Math.random() * 1000000000000000))
    .describe(
      "The same seed and the same prompt given to the same version of the model will output the same image every time."
    ),
  loras: lora_weight
    .array()
    .optional()
    .default([])
    .describe(
      "The LoRAs to use for the image generation. You can use any number of LoRAs and they will be merged together to generate the final image."
    ),
  guidance_scale: z
    .number()
    .min(0)
    .optional()
    .default(3.5)
    .describe(
      "The CFG (Classifier Free Guidance) scale is a measure of prompt adherence. A higher CFG scale means the model will try harder to follow the prompt, but it may also lead to less diverse images."
    ),
  num_images: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("The number of images to generate."),
});

type InputType = z.infer<typeof RequestSchema>;

type ClipTextEncodeNode = {
  inputs: {
    text: string;
    clip: [string, number];
  };
  class_type: "CLIPTextEncode";
  _meta?: {
    title: string;
  };
};
type VaeDecodeNode = {
  inputs: {
    samples: [string, number];
    vae: [string, number];
  };
  class_type: "VAEDecode";
  _meta?: {
    title: string;
  };
};
type SaveImageNode = {
  inputs: {
    filename_prefix: string;
    images: [string, number];
  };
  class_type: "SaveImage";
  _meta?: {
    title: string;
  };
};
type EmptySD3LatentImageNode = {
  inputs: {
    width: number;
    height: number;
    batch_size: number;
  };
  class_type: "EmptySD3LatentImage";
  _meta?: {
    title: string;
  };
};
type CheckpointLoaderSimpleNode = {
  inputs: {
    ckpt_name: string;
  };
  class_type: "CheckpointLoaderSimple";
  _meta?: {
    title: string;
  };
};
type KSamplerNode = {
  inputs: {
    seed: number;
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
    denoise: number;
    model: [string, number];
    positive: [string, number];
    negative: [string, number];
    latent_image: [string, number];
  };
  class_type: "KSampler";
  _meta?: {
    title: string;
  };
};
type FluxGuidanceNode = {
  inputs: {
    guidance: number;
    conditioning: [string, number];
  };
  class_type: "FluxGuidance";
  _meta?: {
    title: string;
  };
};
type LoraLoaderNode = {
  inputs: {
    lora_name: string;
    strength_model: number;
    strength_clip: number;
    model: [string, number];
    clip: [string, number];
  };
  class_type: "LoraLoader";
  _meta?: {
    title: string;
  };
};

async function downloadFileWithWget(
  url: string,
  destination: string
): Promise<void> {
  console.log(`Downloading ${url} to ${destination}`);
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const wget = spawn("wget", [url, "--output-document", destination]);

    wget.stdout.on("data", (data) => {
      if (config.logLevel === "debug" || config.logLevel === "trace") {
        process.stdout.write(data);
      }
    });
    wget.stderr.on("data", (data) => {
      if (config.logLevel === "debug" || config.logLevel === "trace") {
        process.stderr.write(data);
      }
    });

    wget.on("close", (code: number) => {
      if (code === 0) {
        const duration = Date.now() - startTime;
        const seconds = Math.floor(duration / 1000);
        console.log(
          `Downloaded ${url} to ${destination} in ${seconds} seconds`
        );
        resolve();
      } else {
        reject(new Error(`wget exited with code ${code}`));
      }
    });

    wget.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Takes the request, downloads any required loras, and generates a ComfyUI workflow.
 * @param input - The input to the workflow, which is validated against the RequestSchema
 * @returns ComfyWorkflow
 */
async function generateWorkflow(
  input: InputType
): Promise<Record<string, ComfyNode>> {
  const checkpointLoader: CheckpointLoaderSimpleNode = {
    inputs: {
      ckpt_name: input.checkpoint,
    },
    class_type: "CheckpointLoaderSimple",
  };
  const prompt: Record<string, ComfyNode> = {
    "1": checkpointLoader,
  };
  let finalModelClipIndex = 1;
  let lastNodeIndex = 1;
  const loraDownloads: Array<Promise<void>> = [];
  for (let i = 0; i < input.loras.length; i++) {
    // If the lora path is a URL, check to see if it is cached
    let loraName = input.loras[i].path;
    if (input.loras[i].path.startsWith("http")) {
      const loraFileName = path.basename(input.loras[i].path);
      const loraFilePath = path.join(loraDir, loraFileName);
      if (!fs.existsSync(loraFilePath)) {
        // Download the file, stream directly to disk
        const loraFileUrl = input.loras[i].path;
        loraDownloads.push(
          downloadFileWithWget(loraFileUrl, loraFilePath).catch((err) => {
            console.error(`Failed to download ${loraFileUrl}: ${err}`);
          })
        );
      } else {
        console.log(`File ${loraFilePath} already exists, skipping download.`);
      }
      loraName = loraFileName;
    }

    const loraLoader: LoraLoaderNode = {
      inputs: {
        lora_name: loraName,
        strength_model: input.loras[i].scale,
        strength_clip: input.loras[i].scale,
        // This syntax is how nodes are wired together. This says node i+1's 0th output is the model input to this node
        model: [`${i + 1}`, 0],
        clip: [`${i + 1}`, 1],
      },
      class_type: "LoraLoader",
    };
    finalModelClipIndex = i + 2;
    lastNodeIndex = i + 2;
    prompt[finalModelClipIndex.toString()] = loraLoader;
  }
  await Promise.all(loraDownloads);

  const positivePrompt: ClipTextEncodeNode = {
    inputs: {
      text: input.prompt,
      clip: [finalModelClipIndex.toString(), 1],
    },
    class_type: "CLIPTextEncode",
  };
  const negativePrompt: ClipTextEncodeNode = {
    inputs: {
      text: "",
      clip: [finalModelClipIndex.toString(), 1],
    },
    class_type: "CLIPTextEncode",
  };
  const posPromptIndex = (finalModelClipIndex + 1).toString();
  const negPromptIndex = (finalModelClipIndex + 2).toString();
  prompt[posPromptIndex] = positivePrompt;
  prompt[negPromptIndex] = negativePrompt;
  lastNodeIndex += 2;

  const fluxGuidance: FluxGuidanceNode = {
    inputs: {
      guidance: input.guidance_scale,
      conditioning: [posPromptIndex, 0],
    },
    class_type: "FluxGuidance",
  };
  const fluxGuidanceIndex = (lastNodeIndex + 1).toString();
  prompt[fluxGuidanceIndex] = fluxGuidance;
  lastNodeIndex += 1;

  const emptySD3LatentImage: EmptySD3LatentImageNode = {
    inputs: {
      width: 0,
      height: 0,
      batch_size: input.num_images,
    },
    class_type: "EmptySD3LatentImage",
  };
  if (typeof input.image_size === "string") {
    switch (input.image_size) {
      case "square_hd":
        emptySD3LatentImage.inputs.width = 1024;
        emptySD3LatentImage.inputs.height = 1024;
        break;
      case "square":
        emptySD3LatentImage.inputs.width = 512;
        emptySD3LatentImage.inputs.height = 512;
        break;
      case "portrait_4_3":
        emptySD3LatentImage.inputs.width = 768;
        emptySD3LatentImage.inputs.height = 1024;
        break;
      case "portrait_16_9":
        emptySD3LatentImage.inputs.width = 1024;
        emptySD3LatentImage.inputs.height = 576;
        break;
      case "landscape_4_3":
        emptySD3LatentImage.inputs.width = 1024;
        emptySD3LatentImage.inputs.height = 768;
        break;
      case "landscape_16_9":
        emptySD3LatentImage.inputs.width = 576;
        emptySD3LatentImage.inputs.height = 1024;
        break;
      default:
        throw new Error(
          `Invalid image size: ${input.image_size}. Please use one of the predefined sizes.`
        );
    }
  } else {
    emptySD3LatentImage.inputs.width = input.image_size.width;
    emptySD3LatentImage.inputs.height = input.image_size.height;
  }
  const emptySD3LatentImageIndex = (lastNodeIndex + 1).toString();
  prompt[emptySD3LatentImageIndex] = emptySD3LatentImage;
  lastNodeIndex += 1;

  const kSampler: KSamplerNode = {
    inputs: {
      seed: input.seed,
      steps: input.num_inference_steps,
      cfg: 1.0,
      sampler_name: "euler",
      scheduler: "simple",
      denoise: 1.0,
      model: [`${finalModelClipIndex}`, 0],
      positive: [fluxGuidanceIndex, 0],
      negative: [negPromptIndex, 0],
      latent_image: [emptySD3LatentImageIndex, 0],
    },
    class_type: "KSampler",
  };
  const kSamplerIndex = (lastNodeIndex + 1).toString();
  prompt[kSamplerIndex] = kSampler;
  lastNodeIndex += 1;

  const vaeDecode: VaeDecodeNode = {
    inputs: {
      samples: [kSamplerIndex, 0],
      vae: ["1", 2],
    },
    class_type: "VAEDecode",
  };
  const vaeDecodeIndex = (lastNodeIndex + 1).toString();
  prompt[vaeDecodeIndex] = vaeDecode;
  lastNodeIndex += 1;

  const saveImage: SaveImageNode = {
    inputs: {
      filename_prefix: "ComfyUI",
      images: [vaeDecodeIndex, 0],
    },
    class_type: "SaveImage",
  };
  const saveImageIndex = (lastNodeIndex + 1).toString();
  prompt[saveImageIndex] = saveImage;

  return prompt;
}

const workflow: Workflow = {
  RequestSchema,
  generateWorkflow,
  summary: "Clone of Fal.ai Flux Lora",
  description: "Generate an image from a text prompt using 0 or more loras.",
};

export default workflow;
