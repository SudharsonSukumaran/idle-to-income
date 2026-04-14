import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Database, Loader2, CheckCircle2 } from "lucide-react";
import { loadDemoData } from "@/lib/demo-data";

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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadDemo = async () => {
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      await loadDemoData();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to load demo data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
      <p className="mt-2 text-muted-foreground">
        Import inventory and availability data from spreadsheets or databases.
      </p>

      <div className="mt-8 max-w-md rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Demo Data</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Load sample inventory units and availability slots (Meera Excel &amp; Ravi DB sources). This will clear existing data and insert fresh demo rows.
        </p>
        <button
          onClick={handleLoadDemo}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {loading ? "Loading…" : "Load Demo Data"}
        </button>

        {success && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Demo data loaded successfully!
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
