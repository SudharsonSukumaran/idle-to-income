import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import { Upload, Database, Loader2, CheckCircle2, FileSpreadsheet, ArrowRight, Cloud, Files } from "lucide-react";
import { loadDemoData } from "@/lib/demo-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Data — Idle2Income" },
      { name: "description", content: "Upload availability and pricing data." },
    ],
  }),
  component: UploadPage,
});

/* ---- Column mapping hints ---- */
const FIELD_HINTS: Record<string, string[]> = {
  unitName: ["room", "rm", "unit", "table", "slot", "name"],
  date: ["date", "check", "arrival", "start", "day"],
  status: ["status", "avail", "available", "free"],
  price: ["rate", "price", "adr", "amount", "cost"],
  channel: ["channel", "platform", "source", "via"],
  partySize: ["party", "party_size", "guests", "pax", "people"],
  adultCount: ["adult", "adults", "adult_count"],
};

function bestMatch(headers: string[], hints: string[]): string {
  const lower = headers.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return "";
}

/* ---- Normalizers ---- */
function normalizeStatus(raw: unknown): string {
  const v = String(raw ?? "").trim().toLowerCase();
  if (["y", "yes", "available", "open", "free", "1"].includes(v)) return "available";
  if (["n", "no", "booked", "reserved", "0"].includes(v)) return "booked";
  if (["blocked", "maintenance", "hold"].includes(v)) return "blocked";
  return v || "available";
}

function normalizeDate(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const num = Number(raw);
  if (!isNaN(num) && num > 10000) {
    // Excel serial date
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toUnitId(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/* ---- Main component ---- */
function UploadPage() {
  // Demo data state
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // XLSX state
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({
    unitName: "",
    date: "",
    status: "",
    price: "",
    channel: "",
    partySize: "",
    adultCount: "",
  });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // External DB state
  const [extUrl, setExtUrl] = useState("");
  const [extKey, setExtKey] = useState("");
  const [extLoading, setExtLoading] = useState(false);
  const [extResult, setExtResult] = useState<string | null>(null);
  const [extError, setExtError] = useState<string | null>(null);

  // Multi-file upload state
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [multiSourceName, setMultiSourceName] = useState("Combined Sources");
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResult, setMultiResult] = useState<string | null>(null);
  const [multiError, setMultiError] = useState<string | null>(null);
  const multiRef = useRef<HTMLInputElement>(null);

  const handleMultiUpload = async () => {
    if (multiFiles.length === 0) {
      setMultiError("Please select one or more .xlsx files first.");
      return;
    }
    setMultiLoading(true);
    setMultiError(null);
    setMultiResult(null);
    try {
      const XLSX = await import("xlsx");
      const allRecords: any[] = [];
      for (const file of multiFiles) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (json.length === 0) continue;
        const hdrs = Object.keys(json[0]);
        // Auto-map per file (schema normalization)
        const m = {
          unitName: bestMatch(hdrs, FIELD_HINTS.unitName),
          date: bestMatch(hdrs, FIELD_HINTS.date),
          status: bestMatch(hdrs, FIELD_HINTS.status),
          price: bestMatch(hdrs, FIELD_HINTS.price),
          channel: bestMatch(hdrs, FIELD_HINTS.channel),
          partySize: bestMatch(hdrs, FIELD_HINTS.partySize),
          adultCount: bestMatch(hdrs, FIELD_HINTS.adultCount),
        };
        for (const row of json) {
          const unit_id = toUnitId(row[m.unitName]);
          const slot_date = normalizeDate(row[m.date]);
          if (!unit_id || !slot_date) continue;
          const occ = m.partySize ? parseInt(String(row[m.partySize])) || 1 : 1;
          allRecords.push({
            unit_id, slot_date,
            status: normalizeStatus(row[m.status]),
            price: parseFloat(String(row[m.price])) || 0,
            channel: m.channel ? String(row[m.channel] ?? "").toLowerCase() || "direct" : "direct",
            source_name: `${multiSourceName.trim() || "Combined"} / ${file.name}`,
            is_fragment: false,
            party_size: occ,
            adult_count: m.adultCount ? parseInt(String(row[m.adultCount])) || occ : occ,
            occupancy: occ,
          });
        }
      }
      if (allRecords.length === 0) {
        setMultiError("No valid rows found across the selected files.");
        return;
      }
      // Insert in batches
      for (let i = 0; i < allRecords.length; i += 100) {
        const batch = allRecords.slice(i, i + 100);
        const { error } = await supabase.from("availability_slots").insert(batch);
        if (error) throw error;
      }
      setMultiResult(`Combined ${multiFiles.length} file(s) → inserted ${allRecords.length} rows.`);
      toast.success(`Combined ${multiFiles.length} files → ${allRecords.length} rows`);
      setMultiFiles([]);
    } catch (err: any) {
      setMultiError(err.message ?? "Failed to combine files");
    } finally {
      setMultiLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoSuccess(false);
    setDemoError(null);
    try {
      await loadDemoData();
      setDemoSuccess(true);
    } catch (err: any) {
      setDemoError(err.message ?? "Failed to load demo data");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleFetchExternal = async () => {
    setExtError(null);
    setExtResult(null);
    if (!extUrl.trim() || !extKey.trim()) {
      setExtError("Please enter both URL and Anon Key.");
      return;
    }
    if (!/^https?:\/\//.test(extUrl.trim())) {
      setExtError("URL must start with https://");
      return;
    }
    setExtLoading(true);
    try {
      const extClient = createClient(extUrl.trim(), extKey.trim());
      const { data, error } = await extClient
        .from("availability_slots")
        .select("unit_id, slot_date, status, price, channel, is_fragment, party_size, adult_count");
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (rows.length === 0) {
        setExtResult("Connected, but no rows found in external availability_slots.");
        return;
      }
      const records = rows.map((r) => ({
        unit_id: r.unit_id,
        slot_date: r.slot_date,
        status: r.status ?? "available",
        price: r.price ?? 0,
        channel: r.channel ?? "direct",
        is_fragment: r.is_fragment ?? false,
        party_size: r.party_size ?? 1,
        adult_count: r.adult_count ?? 1,
        source_name: "External DB",
      }));
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error: insErr } = await supabase.from("availability_slots").insert(batch);
        if (insErr) throw insErr;
      }
      setExtResult(`Imported ${records.length} rows from External DB.`);
      toast.success(`Imported ${records.length} rows from External DB`);
    } catch (err: any) {
      setExtError(err.message ?? "Failed to fetch from external database");
    } finally {
      setExtLoading(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (json.length === 0) {
      toast.error("No data found in the spreadsheet");
      return;
    }

    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    setFileName(file.name);

    // Auto-map
    setMapping({
      unitName: bestMatch(hdrs, FIELD_HINTS.unitName),
      date: bestMatch(hdrs, FIELD_HINTS.date),
      status: bestMatch(hdrs, FIELD_HINTS.status),
      price: bestMatch(hdrs, FIELD_HINTS.price),
      channel: bestMatch(hdrs, FIELD_HINTS.channel),
      partySize: bestMatch(hdrs, FIELD_HINTS.partySize),
      adultCount: bestMatch(hdrs, FIELD_HINTS.adultCount),
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) processFile(file);
      else toast.error("Please drop an .xlsx, .xls, or .csv file");
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleSave = async () => {
    if (!sourceName.trim()) {
      toast.error("Please enter a source name");
      return;
    }
    if (!mapping.unitName || !mapping.date) {
      toast.error("Please map at least Unit Name and Date columns");
      return;
    }

    setSaving(true);
    try {
      const records = rows.map((row) => ({
        unit_id: toUnitId(row[mapping.unitName]),
        slot_date: normalizeDate(row[mapping.date]),
        status: normalizeStatus(row[mapping.status]),
        price: parseFloat(String(row[mapping.price])) || 0,
        channel: mapping.channel ? String(row[mapping.channel] ?? "").toLowerCase() || "direct" : "direct",
        source_name: sourceName.trim(),
        is_fragment: false,
        party_size: mapping.partySize ? parseInt(String(row[mapping.partySize])) || 1 : 1,
        adult_count: mapping.adultCount ? parseInt(String(row[mapping.adultCount])) || 1 : 1,
      }));

      const valid = records.filter((r) => r.unit_id && r.slot_date);
      if (valid.length === 0) {
        toast.error("No valid rows after normalization");
        setSaving(false);
        return;
      }

      // Insert in batches of 100
      for (let i = 0; i < valid.length; i += 100) {
        const batch = valid.slice(i, i + 100);
        const { error } = await supabase.from("availability_slots").insert(batch);
        if (error) throw error;
      }

      toast.success(`Inserted ${valid.length} rows from "${sourceName}"`);
      setRows([]);
      setHeaders([]);
      setFileName("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  const previewRows = rows.slice(0, 5);
  const mappedFields = ["unitName", "date", "status", "price", "channel", "partySize", "adultCount"] as const;
  const fieldLabels: Record<string, string> = {
    unitName: "Unit Name",
    date: "Date",
    status: "Status",
    price: "Price",
    channel: "Channel",
    partySize: "Party Size",
    adultCount: "Adult Count",
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import availability data from .xlsx spreadsheets or load demo data.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Section 1: File Upload */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload Files
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Supports .xlsx, .xls, and .csv spreadsheets.
          </p>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Source Name
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. Meera Excel"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {fileName ? (
                <span className="text-card-foreground font-medium">{fileName}</span>
              ) : (
                <>Drag &amp; drop a file here, or click to browse (.xlsx, .xls, .csv)</>
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Demo data card */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Demo Data
          </h2>
          <p className="text-sm text-muted-foreground">
            Load sample inventory units and availability slots. This clears existing data and inserts fresh demo rows.
          </p>
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {demoLoading ? "Loading…" : "Load Demo Data"}
          </button>
          {demoSuccess && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Demo data loaded successfully!
            </div>
          )}
          {demoError && <p className="text-sm text-destructive">{demoError}</p>}
        </div>
      </div>

      {/* Section: External DB */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Connect External Data Source
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect to external data sources such as databases, APIs, or data warehouses. (Currently supports Supabase for demo)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Data Source URL
            </label>
            <input
              type="text"
              value={extUrl}
              onChange={(e) => setExtUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Access Key
            </label>
            <input
              type="password"
              value={extKey}
              onChange={(e) => setExtKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Demo supports Supabase. Architecture is extensible to other sources.
        </p>
        <button
          onClick={handleFetchExternal}
          disabled={extLoading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {extLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
          {extLoading ? "Fetching…" : "Fetch Data"}
        </button>
        {extResult && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {extResult}
          </div>
        )}
        {extError && <p className="text-sm text-destructive">{extError}</p>}
      </div>

      {/* Section: Multi-File Upload (combine multiple sources) */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Files className="h-5 w-5 text-primary" />
          Connect External Data Sources
        </h2>
        <p className="text-sm text-muted-foreground">
          Supports files, databases, APIs, and future integrations. Select multiple files at once — schemas are auto-normalised and merged into one unified table.
        </p>
        <div>
          <label className="block text-sm font-medium text-card-foreground mb-1">
            Combined source label
          </label>
          <input
            type="text"
            value={multiSourceName}
            onChange={(e) => setMultiSourceName(e.target.value)}
            placeholder="Combined Sources"
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div
          onClick={() => multiRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground p-6 text-center cursor-pointer"
        >
          <Files className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {multiFiles.length > 0
              ? <span className="text-card-foreground font-medium">{multiFiles.length} file(s) selected</span>
              : <>Click to select multiple files (.xlsx, .xls, .csv)</>}
          </p>
          <input
            ref={multiRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={(e) => setMultiFiles(Array.from(e.target.files ?? []))}
            className="hidden"
          />
        </div>
        {multiFiles.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
            {multiFiles.map((f) => <li key={f.name}>{f.name} <span className="opacity-60">({Math.round(f.size / 1024)} KB)</span></li>)}
          </ul>
        )}
        <button
          onClick={handleMultiUpload}
          disabled={multiLoading || multiFiles.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {multiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Files className="h-4 w-4" />}
          {multiLoading ? "Combining…" : "Combine & Upload All"}
        </button>
        {multiResult && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {multiResult}
          </div>
        )}
        {multiError && <p className="text-sm text-destructive">{multiError}</p>}
      </div>

      {/* Section 2: Column Mapping */}
      {headers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground">Column Mapping</h2>
          <p className="text-sm text-muted-foreground">
            Detected {headers.length} columns. Map them to availability fields:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {mappedFields.map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {fieldLabels[field]}
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Select —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Preview Table */}
      {previewRows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            Preview (first {previewRows.length} rows)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {mappedFields.map((f) => (
                    <th key={f} className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      {fieldLabels[f]}
                      {mapping[f] && (
                        <span className="ml-1 text-primary">← {mapping[f]}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 text-card-foreground">{mapping.unitName ? String(row[mapping.unitName] ?? "") : "—"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.date ? normalizeDate(row[mapping.date]) : "—"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.status ? normalizeStatus(row[mapping.status]) : "—"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.price ? String(parseFloat(String(row[mapping.price])) || 0) : "—"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.channel ? String(row[mapping.channel] ?? "direct").toLowerCase() : "—"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.partySize ? String(parseInt(String(row[mapping.partySize])) || 1) : "1"}</td>
                    <td className="py-2 px-3 text-card-foreground">{mapping.adultCount ? String(parseInt(String(row[mapping.adultCount])) || 1) : "1"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Save button */}
      {rows.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? "Saving…" : `Normalize & Save ${rows.length} rows`}
          </button>
          <span className="text-xs text-muted-foreground">
            Source: {sourceName || "(enter a source name)"}
          </span>
        </div>
      )}
    </div>
  );
}
