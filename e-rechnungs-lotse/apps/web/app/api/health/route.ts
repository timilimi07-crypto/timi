import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Einfacher Liveness-Check für Docker/Load-Balancer. Enthält keine personenbezogenen Daten. */
export function GET() {
  return NextResponse.json({ status: "ok", service: "web" });
}
