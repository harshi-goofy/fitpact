import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Opening the Together tab is the acknowledgement. Clears the unread dot. */
export async function POST() {
  await prisma.comment.updateMany({
    where: { seenAt: null },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
