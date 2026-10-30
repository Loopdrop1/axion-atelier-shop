-- Kunden-Quittung: Der bei der Zahlung gespeicherte MwSt-Satz (orders.vat_rate) ist für Kundenkonten lesbar.
-- Bisher war die Spalte von der Spaltenfreigabe ausgenommen; die Quittung im Konto musste den Satz der Shop-Konfiguration
-- verwenden und wäre nach einer Satzänderung falsch gewesen. Zeilen begrenzt weiterhin die Policy «Bestellungen: eigene
-- oder als Admin lesen» (user_id = auth.uid()); anon hat keine Rechte auf orders.
-- Gleiche Datei wie supabase/migrations/20261030002100_receipt_vat.sql. Mehrfach ausführbar.

grant select (vat_rate) on public.orders to authenticated;
