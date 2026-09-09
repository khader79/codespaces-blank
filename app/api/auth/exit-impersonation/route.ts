import { NextResponse } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/auth-server";

export const runtime = "nodejs";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}