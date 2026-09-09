import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { buildStoreContext } from "@/lib/store-context";
import { STORE_ID } from "@/lib/tenant";
import { requireFeature, tenantIdFromRequest } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 30;

const analystSchema = z.object({
  summary: z
    .string()
    .describe("One or two sentence plain-language summary of store health"),
  highlight: z.object({
    label: z.string(),
    value: z.string(),
  }),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(["up", "down", "flat"]),
      })
    )
    .describe("3 to 5 key metrics with an up/down/flat trend vs the previous month"),
  insights: z
    .array(z.string())
    .describe("3 to 5 specific insights grounded in the provided data"),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        action: z.string().describe("Concrete next step a store owner can take"),
      })
    )
    .describe("2 to 4 prioritized recommendations"),
});

const requestSchema = z
  .object({
    prompt: z.string().trim().max(2000).optional(),
    storeId: z.union([z.number(), z.string()]).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "API Key not configured" },
      { status: 400 }
    );
  }

  const locked = await requireFeature(tenantIdFromRequest(req), "analytics");
  if (locked) return locked;

  const googleAI = createGoogleGenerativeAI({ apiKey });

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const prompt = parsed.data.prompt || "Give an overall inventory health summary.";
    const rawStoreId = parsed.data.storeId;
    const storeId =
      typeof rawStoreId === "number"
        ? rawStoreId
        : rawStoreId !== undefined
          ? Number(rawStoreId)
          : STORE_ID;

    const context = await buildStoreContext(storeId);

    const system = `You are StoreFlow's Business Analyst. You analyze a single retail
store's live inventory and sales data for the last 6 months. Answer ONLY using
the data provided in the DATA section below. Never invent figures. Currency is
USD. Be specific: name products, cite numbers, and compare against the previous
month where possible. Your response MUST follow the provided schema.`;

    const { object } = await generateObject({
      model: googleAI(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
      schema: analystSchema,
      system,
      prompt: `DATA (JSON):\n${JSON.stringify(context)}\n\nQuestion:\n${prompt}`,
    });

    return Response.json(object);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    const isRateLimit =
      /rate limit|quota|429|resource exhausted/i.test(message);
    const isProvider =
      /gemini|google|api key|invalid_api_key|permission/i.test(message);

    return Response.json(
      {
        error: "Analysis failed.",
        detail: message,
        hint: isRateLimit
          ? "The AI provider is rate limited. Try again in a minute."
          : isProvider
            ? "There is a problem with the AI provider configuration. Check GEMINI_API_KEY."
            : undefined,
      },
      { status: isRateLimit ? 429 : isProvider ? 502 : 500 }
    );
  }
}