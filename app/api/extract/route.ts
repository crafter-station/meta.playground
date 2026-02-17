import { createGateway, generateObject, zodSchema } from "ai";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

export const DEFAULT_PROMPT = `Analyze this image and extract comprehensive metadata. Determine facial expressions, emotional state, level of focus and attention, and body language of any subjects present. Identify dominant colors with accurate hex values, visual style, composition, mood, and all visible objects or text. Be precise and descriptive.`;

const metadataSchema = z.object({
  title: z
    .string()
    .describe("A short, descriptive title for the image (5-10 words)"),
  description: z
    .string()
    .describe(
      "A detailed description of the image content, suitable for accessibility and search (2-3 sentences)"
    ),
  category: z
    .string()
    .describe(
      "Primary category: product, portrait, landscape, logo, illustration, icon, photo, graphic, screenshot, document, or other"
    ),
  tags: z
    .array(z.string())
    .describe("5-10 relevant tags for categorization, lowercase"),
  colors: z
    .array(
      z.object({
        name: z.string().describe("Color name like 'navy blue' or 'warm red'"),
        hex: z
          .string()
          .describe("Approximate hex color code like '#1a2b3c'"),
      })
    )
    .describe("3-5 dominant colors visible in the image"),
  mood: z
    .string()
    .describe(
      "The overall mood or feeling conveyed (e.g., professional, playful, serene)"
    ),
  style: z
    .string()
    .describe(
      "Visual style (e.g., minimalist, vintage, modern, flat, photorealistic)"
    ),
  expressions: z
    .string()
    .nullable()
    .describe(
      "Facial expressions detected if people are present (e.g., smiling, focused, contemplative, surprised). Null if no faces visible"
    ),
  emotions: z
    .array(z.string())
    .describe(
      "Emotions conveyed by the image or subjects (e.g., joy, determination, serenity, tension, curiosity)"
    ),
  focusLevel: z
    .string()
    .nullable()
    .describe(
      "Level of focus/attention of subjects if people are present: deep focus, casual, distracted, engaged, relaxed. Null if no people"
    ),
  bodyLanguage: z
    .string()
    .nullable()
    .describe(
      "Body language and posture description if people are present. Null if no people"
    ),
  objects: z
    .array(z.string())
    .describe("Key objects or elements visible in the image"),
  textContent: z
    .string()
    .nullable()
    .describe("Any text visible in the image, or null if none"),
  altText: z
    .string()
    .describe("Concise, accessible alt text for screen readers (one sentence)"),
});

export type MetadataResult = z.infer<typeof metadataSchema>;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const { success, limit, remaining, reset } = await checkRateLimit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  const formData = await req.formData();
  const image = formData.get("image") as File | null;
  const modelId = formData.get("model") as string | null;
  const prompt = (formData.get("prompt") as string | null) || DEFAULT_PROMPT;

  if (!image || !modelId) {
    return NextResponse.json(
      { error: "Missing image or model" },
      { status: 400 }
    );
  }

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const startTime = Date.now();

  try {
    const { object, usage } = await generateObject({
      model: gateway(modelId),
      schema: zodSchema(metadataSchema),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image",
              image: imageBytes,
            },
          ],
        },
      ],
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      metadata: object,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      duration,
      model: modelId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to extract metadata";
    console.error(`[extract] ${modelId} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
