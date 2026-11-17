import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Healthcheck für Docker/Load-Balancer. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", component: "database" }, { status: 503 });
  }
}
