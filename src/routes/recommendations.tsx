import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "AI Recommendations — Idle2Income" },
      { name: "description", content: "AI-powered revenue recovery recommendations." },
    ],
  }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">AI Recommendations</h1>
      <p className="mt-2 text-muted-foreground">Content coming soon</p>
    </div>
  );
}
