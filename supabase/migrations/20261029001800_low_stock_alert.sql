-- Meldung an den Shop, wenn der Bestand einer Grösse mit einer bezahlten Bestellung die Schwelle erreicht.
-- low_stock_after_order(order, threshold): die Positionen der Bestellung, deren Bestand jetzt <= Schwelle ist,
-- vorher (Bestand + bestellte Menge) aber darüber lag. Der Bestand wird schon beim Reservieren der Kasse abgebucht;
-- gemeldet wird erst bei Zahlungseingang (Webhook), damit abgelaufene Kassen keine Meldung auslösen.
-- Nur lesen, nur für service_role (Edge Function stripe-webhook).
-- Gleiche Datei in drizzle/migrations (Cloud). Mehrfach ausführbar.

create or replace function public.low_stock_after_order(p_order_id uuid, p_threshold int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'variant_id', x.variant_id, 'handle', x.handle, 'title', x.title, 'color', x.color, 'size', x.size,
      'stock', x.stock, 'quantity', x.quantity) order by x.title, x.size), '[]'::jsonb)
  from (
    select i.variant_id, min(i.handle) as handle, min(i.title) as title, min(i.color) as color,
      min(i.size) as size, v.stock, sum(i.quantity)::int as quantity
    from public.order_items i
    join public.orders o on o.id = i.order_id
    join public.product_variants v on v.id = i.variant_id
    where i.order_id = p_order_id and o.kind = 'cart' and o.status in ('paid', 'shipped')
    group by i.variant_id, v.stock
    having v.stock <= greatest(coalesce(p_threshold, 0), 0)
      and v.stock + sum(i.quantity) > greatest(coalesce(p_threshold, 0), 0)
  ) x
$$;

revoke all on function public.low_stock_after_order(uuid, int) from public, anon, authenticated;
grant execute on function public.low_stock_after_order(uuid, int) to service_role;
