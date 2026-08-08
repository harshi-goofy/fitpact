import { NextResponse } from "next/server";
import { loadBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 90);
  const board = await loadBoard(Number.isFinite(days) ? Math.min(days, 365) : 90);
  return NextResponse.json(board);
}
