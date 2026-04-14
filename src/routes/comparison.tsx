import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "Comparison — Idle2Income" },
      { name: "description", content: "Compare availability across channels." },
    ],
  }),
  component: ComparisonPage,
});

function ComparisonPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Comparison</h1>
      <p className="mt-2 text-muted-foreground">Content coming soon</p>
    </div>
  );
}
