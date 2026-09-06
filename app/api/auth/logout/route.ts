import { NextResponse } from "next/server";
import { ACCESS_COOKIE, OPERATOR_COOKIE, PRIMARY_COOKIE, REFRESH_COOKIE } from "@/lib/auth-server";
export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, PRIMARY_COOKIE, OPERATOR_COOKIE]) response.cookies.delete(name);
  return response;
}