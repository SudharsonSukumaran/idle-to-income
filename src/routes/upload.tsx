import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Data — Idle2Income" },
      { name: "description", content: "Upload availability and pricing data." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
      <p className="mt-2 text-muted-foreground">Content coming soon</p>
    </div>
  );
}
