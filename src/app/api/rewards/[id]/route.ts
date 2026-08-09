import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { loadBoard } from "@/lib/board";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Mark a reward as claimed (or un-claim it).
 *
 * Either person can do this — a reward is something the two of you do
 * together, so there's no sense in one of you being the only one who can
 * tick it off. What is enforced: you can't claim a reward you haven't
 * earned, because that is the entire point of it having a threshold.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const claimed = body.claimed;
  if (typeof claimed !== "boolean") {
    return NextResponse.json({ error: "claimed must be a boolean" }, { status: 400 });
  }

  const reward = await prisma.reward.findUnique({ where: { id } });
  if (!reward) {
    return NextResponse.json({ error: "No such reward" }, { status: 404 });
  }

  // Re-derive earned from the live board rather than trusting the client.
  if (claimed) {
    const board = await loadBoard();
    const current = board.stats.rewards.rewards.find((r) => r.id === id);
    if (!current?.earned) {
      return NextResponse.json(
        { error: "Not unlocked yet — keep going." },
        { status: 403 },
      );
    }
  }

  await prisma.reward.update({
    where: { id },
    data: { claimedAt: claimed ? new Date() : null },
  });

  return NextResponse.json(await loadBoard());
}
