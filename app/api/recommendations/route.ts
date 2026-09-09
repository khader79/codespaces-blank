import { getAiRecommendations } from "@/lib/ai-recommendations";
import { requireFeature, tenantIdFromRequest } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const locked = await requireFeature(tenantIdFromRequest(req), "ai");
    if (locked) return locked;
    const recommendations = await getAiRecommendations();
    return Response.json(recommendations);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load alerts." },
      { status: 500 }
    );
  }
}