import Board from "@/components/Board";
import { loadBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const board = await loadBoard(90);
    return <Board initial={board} />;
  } catch (err) {
    // Almost always "you haven't run the seed yet". Say so plainly rather than
    // showing a stack trace on a phone at 11pm.
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-xl font-semibold">FitPact isn&apos;t set up yet</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          {err instanceof Error ? err.message : "Could not load the board."}
        </p>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Check <code className="text-[var(--color-text)]">DATABASE_URL</code>, then run{" "}
          <code className="text-[var(--color-text)]">npm run db:push</code> and{" "}
          <code className="text-[var(--color-text)]">npm run db:seed</code>. See SETUP.md.
        </p>
      </main>
    );
  }
}
