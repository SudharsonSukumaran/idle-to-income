import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Idle2Income" },
      { name: "description", content: "Revenue recovery dashboard overview." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Content coming soon</p>
    </div>
  );
}
