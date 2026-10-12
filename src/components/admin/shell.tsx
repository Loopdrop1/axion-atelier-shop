// Rahmen fürs Admin: Zugangsprüfung, Navigation, Fusszeile «Made by Flowrenix.com».
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  FolderTree,
  Gift,
  LogOut,
  Mail,
  Menu,
  Package,
  PanelsTopLeft,
  Percent,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { backendConfigured } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin/api";
import { signOut } from "@/lib/account/api";
import { useSession } from "@/lib/account/session";
import { Loading } from "./ui";

const NAV = [
  { to: "/admin", label: "Übersicht", icon: BarChart3, exact: true },
  { to: "/admin/bestellungen", label: "Bestellungen", icon: ShoppingBag },
  { to: "/admin/produkte", label: "Produkte", icon: Package },
  { to: "/admin/kategorien", label: "Kategorien", icon: FolderTree },
  { to: "/admin/lager", label: "Lager", icon: Boxes },
  { to: "/admin/rabattcodes", label: "Rabattcodes", icon: Percent },
  { to: "/admin/gutscheine", label: "Gutscheine", icon: Gift },
  { to: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { to: "/admin/inhalte", label: "Startseite und Laufband", icon: PanelsTopLeft },
  { to: "/admin/zugaenge", label: "Zugänge", icon: Users },
  { to: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

function useAdminSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    queryClient.removeQueries({ queryKey: ["admin"] });
  };
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const out = useAdminSignOut();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {NAV.map((item) => {
        const Icon = item.icon;
        // Der Router setzt die Klasse «active» selbst (Übersicht nur bei genau /admin).
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item, includeSearch: false }}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <div className="admin-nav-bottom">
        <a href="/" target="_blank" rel="noopener">
          <Store aria-hidden="true" />
          Shop ansehen
        </a>
        <button type="button" onClick={() => void out()}>
          <LogOut aria-hidden="true" />
          Abmelden
        </button>
      </div>
    </nav>
  );
}

export function AdminFooter() {
  return (
    <footer className="admin-footer">
      <span>Axion Admin</span>
      <a href="https://flowrenix.com" target="_blank" rel="noopener">
        Made by Flowrenix.com
      </a>
    </footer>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="admin">
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}

/** Seite ohne Navigation (Anmeldung, Kein Zugriff). */
export function AdminBare({ children }: { children: ReactNode }) {
  return (
    <Frame>
      <main className="admin-bare">
        <p className="admin-brand">AXION · Admin</p>
        {children}
      </main>
      <AdminFooter />
    </Frame>
  );
}

/** Prüft Anmeldung und Admin-Rolle, dann Navigation und Inhalt. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { ready, user } = useSession();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const out = useAdminSignOut();
  const redirected = useRef(false);
  const role = useQuery({
    queryKey: ["admin", "is-admin", user?.id],
    queryFn: () => isAdmin(user!.id),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!backendConfigured || !ready || user || redirected.current) return;
    redirected.current = true;
    void navigate({ to: "/admin/anmelden", search: { weiter: path }, replace: true });
  }, [ready, user, navigate, path]);

  if (!backendConfigured)
    return (
      <AdminBare>
        <h1>Admin noch nicht verbunden</h1>
        <p className="admin-muted">
          Das Admin arbeitet direkt mit der Datenbank. Es funktioniert, sobald Supabase eingerichtet
          ist (Anleitung: docs/DEPLOYMENT.md).
        </p>
      </AdminBare>
    );
  if (!ready || !user || role.isLoading)
    return (
      <AdminBare>
        <Loading />
      </AdminBare>
    );
  if (role.isError || !role.data)
    return (
      <AdminBare>
        <h1>Kein Zugriff</h1>
        <p className="admin-muted">
          Du bist als {user.email} angemeldet, hast aber keine Admin-Rechte. Ein Admin kann dir
          unter «Zugänge» Rechte geben.
        </p>
        <Button variant="admin" onClick={() => void out()}>
          Abmelden
        </Button>
      </AdminBare>
    );

  return (
    <Frame>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="admin-brand">AXION · Admin</p>
          <Nav />
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Menü öffnen">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="admin admin-sheet">
                <SheetTitle className="admin-brand">AXION · Admin</SheetTitle>
                <Nav onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <p className="admin-brand">AXION · Admin</p>
          </header>
          <main className="admin-content">{children}</main>
          <AdminFooter />
        </div>
      </div>
    </Frame>
  );
}
