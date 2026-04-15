import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Idle2Income — Revenue Recovery Platform" },
      { name: "description", content: "Hospitality revenue recovery platform that identifies lost revenue and provides AI-powered recommendations." },
      { property: "og:title", content: "Idle2Income — Revenue Recovery Platform" },
      { name: "twitter:title", content: "Idle2Income — Revenue Recovery Platform" },
      { property: "og:description", content: "Hospitality revenue recovery platform that identifies lost revenue and provides AI-powered recommendations." },
      { name: "twitter:description", content: "Hospitality revenue recovery platform that identifies lost revenue and provides AI-powered recommendations." },
      { name: "twitter:card", content: "summary" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        {/* Top navbar */}
        <header className="flex h-14 items-center justify-end border-b border-border bg-background px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white shrink-0">
              SS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground leading-tight">Sudharson S</span>
              <span className="text-xs text-muted-foreground leading-tight">Revenue Analyst</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
