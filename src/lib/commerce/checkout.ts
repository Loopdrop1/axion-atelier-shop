// Kasse, Rabattcodes, Gutscheine und Bestellstatus aus Sicht des Browsers.
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { callFunction } from "@/integrations/supabase/functions";
import type { Locale } from "@/i18n/locale";

export interface DiscountCheck {
  valid: boolean;
  reason?: string;
  code?: string;
  kind?: "percent" | "amount";
  value?: number;
  discount_cents?: number;
  min_subtotal_cents?: number;
}

export interface GiftCardCheck {
  valid: boolean;
  reason?: string;
  balance_cents?: number;
  expires_at?: string;
}

export async function checkDiscount(code: string, subtotalCents: number): Promise<DiscountCheck> {
  if (!backendConfigured) return { valid: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("check_discount", {
    p_code: code,
    p_subtotal_cents: subtotalCents,
  });
  if (error) throw error;
  return data as unknown as DiscountCheck;
}

export async function checkGiftCard(code: string): Promise<GiftCardCheck> {
  if (!backendConfigured) return { valid: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("check_gift_card", { p_code: code });
  if (error) throw error;
  return data as unknown as GiftCardCheck;
}

export type CheckoutInput =
  | {
      kind: "cart";
      lines: { variantId: string; quantity: number }[];
      email?: string | undefined;
      discountCode?: string | undefined;
      giftCardCode?: string | undefined;
      locale: Locale;
    }
  | {
      kind: "gift_card";
      amountCents: number;
      recipientName?: string | undefined;
      recipientEmail?: string | undefined;
      senderName?: string | undefined;
      message?: string | undefined;
      email?: string | undefined;
      locale: Locale;
    };

export type CheckoutResult =
  | { ok: true; url: string; orderNumber: number }
  | {
      ok: false;
      error: string;
      reason?: string | undefined;
      items?: { variantId: string; available: number }[] | undefined;
    };

export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const result = await callFunction<{ url: string; orderNumber: number }>("checkout", input);
  if (result.ok) return { ok: true, url: result.data.url, orderNumber: result.data.orderNumber };
  const items = result.body["items"];
  const reason = result.body["reason"];
  return {
    ok: false,
    error: result.error,
    reason: typeof reason === "string" ? reason : undefined,
    items: Array.isArray(items) ? (items as { variantId: string; available: number }[]) : undefined,
  };
}

export type OrderStatusValue = "pending" | "paid" | "shipped" | "cancelled" | "refunded";

export interface OrderStatus {
  order_number: number;
  status: OrderStatusValue;
  kind: "cart" | "gift_card";
  total_cents: number;
  email_hint: string;
  /** Nur bei versandten Bestellungen */
  tracking_number?: string | null;
}

export async function getOrderStatus(token: string): Promise<OrderStatus | null> {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data, error } = await supabase.rpc("get_order_status", { p_token: token });
  if (error) throw error;
  return (data as unknown as OrderStatus | null) ?? null;
}

/** Nach Abbruch in der Stripe-Kasse: Reservierung über das Token aus der cancel_url freigeben. */
export async function releaseCheckout(token: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return false;
  const result = await callFunction<{ released: boolean }>("checkout", { kind: "release", token });
  return result.ok && result.data.released;
}
