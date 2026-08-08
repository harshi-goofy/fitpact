import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPartner, getTracker } from "@/lib/board";
import { keyToDate } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Post a comment or a cheer against a day.
 *
 * Deliberately NOT subject to the edit window — the point of the partner half
 * of the app is being able to say something about last Tuesday.
 */
export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Bad date format" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.body === "string" ? body.body.trim().slice(0, 500) : "";
  if (text === "") {
    return NextResponse.json({ error: "Comment can't be empty" }, { status: 400 });
  }

  // There is no login, so the client states who is speaking. With exactly two
  // people who both already have the URL, this is a labelling choice rather
  // than an access-control one.
  const asPartner = body.asPartner !== false;
  const author = asPartner ? await getPartner() : await getTracker();
  if (!author) {
    return NextResponse.json({ error: "No partner account. Run the seed." }, { status: 400 });
  }

  await prisma.comment.create({
    data: {
      date: keyToDate(date),
      authorId: author.id,
      body: text,
      cheer: body.cheer === true,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
