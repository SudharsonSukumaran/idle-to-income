import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, UserCog, Users } from "lucide-react";

export const Route = createFileRoute("/access-control")({
  head: () => ({
    meta: [
      { title: "Access Control — Idle2Income" },
      { name: "description", content: "Manage roles and access across the platform." },
    ],
  }),
  component: AccessControlPage,
});

const ROLES = [
  {
    name: "Super Admin",
    icon: ShieldCheck,
    tone: "bg-primary/10 text-primary border-primary/30",
    description: "Full system access, billing, integrations, and role assignment.",
    members: 1,
  },
  {
    name: "Admin",
    icon: UserCog,
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    description: "Manage inventory, recommendations, conflict resolution and reports.",
    members: 3,
  },
  {
    name: "Operations",
    icon: Users,
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    description: "Day-to-day bookings, availability updates, and on-floor operations.",
    members: 8,
  },
];

function AccessControlPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Access Control</h1>
        <p className="text-sm text-muted-foreground">
          Role-based access overview. (UI preview — wiring coming soon.)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <div key={r.name} className={`rounded-lg border p-5 ${r.tone}`}>
            <div className="flex items-center gap-2 mb-2">
              <r.icon className="h-5 w-5" />
              <h2 className="text-base font-semibold">{r.name}</h2>
            </div>
            <p className="text-xs opacity-80 mb-3">{r.description}</p>
            <p className="text-xs font-medium">{r.members} member{r.members === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-card-foreground mb-3">Permission Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Capability</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Super Admin</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Admin</th>
                <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Operations</th>
              </tr>
            </thead>
            <tbody className="text-card-foreground">
              {[
                ["View dashboard", true, true, true],
                ["Edit availability", true, true, true],
                ["Apply AI recommendations", true, true, false],
                ["Manage integrations", true, false, false],
                ["Manage roles & access", true, false, false],
              ].map(([cap, a, b, c]) => (
                <tr key={cap as string} className="border-b border-border last:border-0">
                  <td className="py-2 px-3">{cap}</td>
                  <td className="py-2 px-3 text-center">{a ? "✓" : "—"}</td>
                  <td className="py-2 px-3 text-center">{b ? "✓" : "—"}</td>
                  <td className="py-2 px-3 text-center">{c ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}