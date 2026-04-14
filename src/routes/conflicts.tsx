import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts — Idle2Income" },
      { name: "description", content: "Review and resolve merge conflicts." },
    ],
  }),
  component: ConflictsPage,
});

function ConflictsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Conflicts</h1>
      <p className="mt-2 text-muted-foreground">Content coming soon</p>
    </div>
  );
}
