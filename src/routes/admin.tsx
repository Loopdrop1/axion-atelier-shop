// Admin unter /admin (nur Deutsch, eigenes Layout, nicht für Suchmaschinen).
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/shell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · Axion" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const login = useRouterState({
    select: (s) => /^\/admin\/anmelden\/?$/.test(s.location.pathname),
  });
  if (login) return <Outlet />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
