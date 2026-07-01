import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";

const AUTH_PATHS = ["/login", "/register"];
const PROTECTED_PATH_PREFIXES = ["/simple-search", "/advanced-search", "/detect", "/result", "/history"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { email, ready } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthPage = AUTH_PATHS.includes(pathname);
  const protectedPage = isProtectedPath(pathname);

  useEffect(() => {
    if (!ready) return;

    if (!email && protectedPage) {
      navigate({ to: "/login", replace: true });
      return;
    }

    if (email && isAuthPage) {
      navigate({ to: "/", replace: true });
    }
  }, [email, ready, protectedPage, isAuthPage, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (!email && protectedPage) return null;
  if (email && isAuthPage) return null;

  return <>{children}</>;
}


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CiteVerifier — Every citation, beyond doubt." },
      { name: "description", content: "CiteVerifier verifies whether a paper truly exists. In seconds." },
      { name: "author", content: "CiteVerifier" },
      { property: "og:title", content: "CiteVerifier" },
      { property: "og:description", content: "Every citation, beyond doubt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwOTA5MGIiLz4KICA8cGF0aCBkPSJNMTggNDAgQzE4IDI0IDI0LjUgMTMgMzIgMTMgQzM5LjUgMTMgNDYgMjQgNDYgNDAgTDQ2IDQ3IFE0MSA1NiAzNiA0NyBRMzEgNTYgMjYgNDcgUTIxIDU2IDE4IDQ3IFoiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iMjYiIGN5PSIzMiIgcj0iMy41IiBmaWxsPSIjMDkwOTBiIi8+CiAgPGNpcmNsZSBjeD0iMzgiIGN5PSIzMiIgcj0iMy41IiBmaWxsPSIjMDkwOTBiIi8+Cjwvc3ZnPg==",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
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
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <AuthGate>
            <Outlet />
          </AuthGate>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

