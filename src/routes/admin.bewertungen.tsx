// Kundenbewertungen prüfen: freigeben, ablehnen, Notiz, löschen. Nur mit shopConfig.features.reviews im Menü; im Shop
// erscheinen freigegebene Bewertungen nur, wenn zusätzlich Admin → Einstellungen → «Bewertungen» an ist.
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import {
  deleteReview,
  listReviews,
  REVIEW_STATUS,
  REVIEWS_PAGE_SIZE,
  updateReview,
  type AdminReview,
  type ReviewStatus,
} from "@/lib/admin/reviews-api";
import {
  AreaField,
  Badge,
  ConfirmButton,
  dateTime,
  ErrorBox,
  Loading,
  notify,
  PageHeader,
} from "@/components/admin/ui";

const VIEWS = [
  { value: "pending", label: "Zu prüfen" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "all", label: "Alle" },
] as const;

type View = ReviewStatus | "all";

interface Search {
  ansicht?: View | undefined;
  seite?: number | undefined;
}

export const Route = createFileRoute("/admin/bewertungen")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ansicht: VIEWS.some((v) => v.value === s["ansicht"]) ? (s["ansicht"] as View) : undefined,
    seite:
      Number.isInteger(Number(s["seite"])) && Number(s["seite"]) > 0
        ? Number(s["seite"])
        : undefined,
  }),
  component: Reviews,
});

function Reviews() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/bewertungen" });
  const view: View = search.ansicht ?? "pending";
  const page = (search.seite ?? 1) - 1;
  const query = useQuery({
    queryKey: ["admin", "reviews", view, page],
    queryFn: () => listReviews(view, page),
    placeholderData: keepPreviousData,
    enabled: shopConfig.features.reviews,
  });
  const pages = Math.max(1, Math.ceil((query.data?.count ?? 0) / REVIEWS_PAGE_SIZE));

  if (!shopConfig.features.reviews)
    return (
      <>
        <PageHeader title="Bewertungen" />
        <p className="admin-empty">
          Kundenbewertungen sind nicht eingeschaltet (kostenpflichtige Option, im Code unter
          features.reviews).
        </p>
      </>
    );

  return (
    <>
      <PageHeader
        title="Bewertungen"
        description="Bewertungen aus echten Käufen (Link in der Versandmeldung). Sie erscheinen im Shop erst nach der Freigabe und nur, wenn unter Einstellungen «Bewertungen» eingeschaltet ist. Auf Wunsch der Person löschen."
      />
      <div className="admin-toolbar">
        <nav className="admin-tabs" aria-label="Ansicht">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              to="/admin/bewertungen"
              search={{ ansicht: v.value }}
              className={view === v.value ? "active" : ""}
              activeProps={{ className: "" }}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.rows.length ? (
        <p className="admin-empty">Keine Bewertungen in dieser Ansicht.</p>
      ) : (
        <>
          <ul className="admin-review-list">
            {query.data.rows.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>
          <div className="admin-pager">
            <span className="admin-muted">
              {query.data.count} {query.data.count === 1 ? "Bewertung" : "Bewertungen"} · Seite{" "}
              {page + 1} von {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() =>
                void navigate({ search: (s) => ({ ...s, seite: page > 1 ? page : undefined }) })
              }
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pages}
              onClick={() => void navigate({ search: (s) => ({ ...s, seite: page + 2 }) })}
            >
              Weiter
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function ReviewCard({ review: r }: { review: AdminReview }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(r.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const status = REVIEW_STATUS[r.status];

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await action();
      notify.ok(done);
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="admin-review">
      <div className="admin-review-head">
        <strong aria-label={`${r.rating} von 5 Sternen`}>
          {"★".repeat(r.rating)}
          <span aria-hidden="true" className="admin-muted">
            {"★".repeat(5 - r.rating)}
          </span>
        </strong>
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="admin-muted">
          {r.products?.title_de ?? "Produkt gelöscht"} · {r.orders ? `AX-${r.orders.number}` : "–"}{" "}
          · {dateTime(r.created_at)} · {r.locale.toUpperCase()}
        </span>
      </div>
      {r.title && <h3 className="admin-review-title">{r.title}</h3>}
      <p className="admin-review-body">{r.body}</p>
      <p className="admin-muted">Anzeigename: {r.display_name}</p>
      <AreaField
        label="Interne Notiz"
        hint="Nur im Admin sichtbar."
        value={note}
        maxLength={2000}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="admin-actions-row">
        {r.status !== "approved" && (
          <Button
            variant="admin"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                () => updateReview(r.id, { status: "approved", admin_note: note.trim() || null }),
                "Bewertung freigegeben.",
              )
            }
          >
            Freigeben
          </Button>
        )}
        {r.status !== "rejected" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                () => updateReview(r.id, { status: "rejected", admin_note: note.trim() || null }),
                "Bewertung abgelehnt.",
              )
            }
          >
            Ablehnen
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || note.trim() === (r.admin_note ?? "")}
          onClick={() =>
            void run(
              () => updateReview(r.id, { admin_note: note.trim() || null }),
              "Notiz gespeichert.",
            )
          }
        >
          Notiz speichern
        </Button>
        <ConfirmButton
          label="Löschen"
          title="Bewertung löschen?"
          description="Zum Beispiel auf Wunsch der Person. Die Bewertung ist danach endgültig weg."
          confirmLabel="Löschen"
          disabled={busy}
          onConfirm={() => run(() => deleteReview(r.id), "Bewertung gelöscht.")}
        />
      </div>
    </li>
  );
}
