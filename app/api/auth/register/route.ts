import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  adminFullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  activationCode: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please complete all fields with valid values." }, { status: 400 });

  try {
    const admin = getSupabaseAdmin();
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.adminFullName },
    });
    if (userError || !created.user) return Response.json({ error: userError?.message ?? "Could not create account." }, { status: 400 });

    const { data: tenantId, error: provisionError } = await admin.rpc("provision_tenant", {
      company_name: parsed.data.companyName,
      owner_user_id: created.user.id,
      activation_code: parsed.data.activationCode || null,
    });
    if (provisionError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return Response.json({ error: provisionError.message }, { status: 400 });
    }
    return Response.json({ ok: true, tenantId, message: "Account created. You can now sign in." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Registration is temporarily unavailable." }, { status: 503 });
  }
}
