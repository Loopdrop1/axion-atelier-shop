// E-Mail-Rahmen im Axion-Stil: Tabellen-Layout mit Inline-Styles (funktioniert in Outlook, Gmail, Apple Mail).
import type { Locale } from "../money.ts";

export const COLORS = {
  green: "#1E3A2F",
  deep: "#12261D",
  sand: "#E9E1D2",
  paper: "#F5F1E8",
  gold: "#B8955A",
  ink: "#141414",
  grey: "#5F5F5F",
  line: "#E2DCCF",
};

const FONT = "Helvetica, Arial, sans-serif";

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mehrzeiliger Text: escapen und Zeilenumbrüche erhalten. */
export function escLines(value: unknown): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

export interface ShopInfo {
  name: string;
  siteUrl: string;
  contactEmail: string;
  address: string;
}

export function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:600;color:${COLORS.ink};">${esc(text)}</h1>`;
}

export function p(
  html: string,
  opts: { muted?: boolean; size?: number; margin?: string } = {},
): string {
  return `<p style="margin:${opts.margin ?? "0 0 14px"};font-family:${FONT};font-size:${opts.size ?? 15}px;line-height:1.6;color:${opts.muted ? COLORS.grey : COLORS.ink};">${html}</p>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
<td style="background:${COLORS.green};border-radius:2px;">
<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.paper};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

/** Hervorgehobener Code (Gutschein, Rabatt, Sendungsnummer). Lange Codes kleiner, damit sie auf dem Handy auf eine Zeile passen. */
export function codeBox(code: string, caption?: string): string {
  const long = code.length > 18;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr>
<td style="background:${COLORS.paper};border:1px solid ${COLORS.line};padding:18px 12px;text-align:center;">
${caption ? `<div style="font-family:${FONT};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.grey};margin-bottom:6px;">${esc(caption)}</div>` : ""}
<div style="font-family:'Courier New', Courier, monospace;font-size:${long ? 16 : 19}px;letter-spacing:${long ? 1 : 1.5}px;font-weight:700;color:${COLORS.ink};word-break:break-all;">${esc(code)}</div>
</td></tr></table>`;
}

export function divider(): string {
  return `<div style="height:1px;line-height:1px;background:${COLORS.line};margin:20px 0;">&nbsp;</div>`;
}

export function label(text: string): string {
  return `<div style="font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.gold};margin:0 0 6px;">${esc(text)}</div>`;
}

/** Zeilen mit Text links und Betrag rechts. */
export function rows(entries: { left: string; right: string; strong?: boolean }[]): string {
  const tr = entries
    .map(
      (e) => `<tr>
<td style="padding:6px 0;font-family:${FONT};font-size:14px;color:${COLORS.ink};${e.strong ? "font-weight:700;" : ""}">${e.left}</td>
<td align="right" style="padding:6px 0;font-family:${FONT};font-size:14px;color:${COLORS.ink};white-space:nowrap;${e.strong ? "font-weight:700;" : ""}">${e.right}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tr}</table>`;
}

export function layout(opts: {
  locale: Locale;
  subject: string;
  preheader: string;
  body: string;
  shop: ShopInfo;
  footerNote?: string;
}): string {
  const { shop } = opts;
  const legal = opts.locale === "en" ? "Terms" : "AGB";
  const privacy = opts.locale === "en" ? "Privacy" : "Datenschutz";
  const prefix = opts.locale === "en" ? "/en" : "";
  const footer = [
    esc(shop.name),
    shop.address ? esc(shop.address) : "",
    shop.contactEmail
      ? `<a href="mailto:${esc(shop.contactEmail)}" style="color:${COLORS.grey};">${esc(shop.contactEmail)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<!doctype html>
<html lang="${opts.locale === "en" ? "en" : "de-CH"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(opts.subject)}</title>
<style>
@media only screen and (max-width: 480px) {
  .ax-outer { padding: 0 !important; }
  .ax-pad { padding-left: 20px !important; padding-right: 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.paper};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.paper};">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};">
<tr><td class="ax-outer" align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;">
<tr><td class="ax-pad" style="background:${COLORS.green};padding:26px 32px;">
<a href="${esc(shop.siteUrl + prefix + "/")}" style="font-family:${FONT};font-size:20px;letter-spacing:7px;font-weight:600;color:${COLORS.sand};text-decoration:none;">AXION</a>
</td></tr>
<tr><td class="ax-pad" style="padding:32px 32px 18px;">
${opts.body}
</td></tr>
<tr><td class="ax-pad" style="padding:18px 32px 26px;background:${COLORS.paper};font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.grey};">
${opts.footerNote ? `<div style="margin-bottom:8px;">${opts.footerNote}</div>` : ""}
<div>${footer}</div>
<div style="margin-top:6px;"><a href="${esc(shop.siteUrl + prefix + "/agb")}" style="color:${COLORS.grey};">${legal}</a> · <a href="${esc(shop.siteUrl + prefix + "/datenschutz")}" style="color:${COLORS.grey};">${privacy}</a></div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
