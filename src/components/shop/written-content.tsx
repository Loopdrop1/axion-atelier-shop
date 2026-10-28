import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { shopConfig } from "@/config/shop";
import { pages, type PageBlock, type WrittenPage } from "@/content/pages";
import { pagesEn } from "@/content/pages-en";
import { useLocale, useLocaleParam, useT } from "@/i18n";
import { shippingLabel } from "@/lib/commerce/shipping-text";
import { useShopSettings } from "@/lib/commerce/use-settings";
import { plausibleDomain } from "@/lib/marketing";

const variables = {
  brand: shopConfig.brand,
  company: shopConfig.contact.company,
  address: shopConfig.contact.address,
  email: shopConfig.contact.email,
  phone: shopConfig.contact.phone,
  uid: shopConfig.contact.uid,
  returnDays: String(shopConfig.returnDays),
};
export function resolvePageVariables(text: string) {
  return text.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    key in variables ? String(variables[key as keyof typeof variables]) : token,
  );
}
/** Bedingte Aufzählungspunkte: Beginnt ein Punkt mit {{analytics}}, erscheint er nur, wenn die Besucherstatistik
 *  in shop.ts eingeschaltet ist (analytics.plausibleDomain); die Marke selbst wird nie angezeigt. */
const ANALYTICS_MARK = "{{analytics}}";
export function visibleItems(items: string[], analytics = plausibleDomain() !== ""): string[] {
  return items
    .filter((text) => analytics || !text.startsWith(ANALYTICS_MARK))
    .map((text) => (text.startsWith(ANALYTICS_MARK) ? text.slice(ANALYTICS_MARK.length) : text));
}
export function pageHasPlaceholder(page: WrittenPage) {
  const strings: string[] = [page.title];
  for (const section of page.sections) {
    if (section.heading) strings.push(section.heading);
    for (const block of section.blocks) {
      if (block.type === "paragraph") strings.push(block.text);
      else if (block.type === "bullets" || block.type === "steps")
        strings.push(...visibleItems(block.items));
      else if (block.type === "definitions")
        block.items.forEach((item) => strings.push(item.label, item.value));
      else if (block.type === "questions")
        block.items.forEach((item) => strings.push(item.question, item.answer));
    }
  }
  return strings.some((text) => /\[/.test(resolvePageVariables(text)));
}

/** {{shipping}}: Versandangabe aus den Einstellungen im Admin (wie die Versandleiste), nie fest im Text. */
function ShippingText() {
  const settings = useShopSettings();
  const locale = useLocale();
  return <>{shippingLabel(settings, locale)}</>;
}
export function InlineText({
  text,
  marked = false,
  variablesEnabled = true,
}: {
  text: string;
  marked?: boolean;
  variablesEnabled?: boolean;
}) {
  const nodes: ReactNode[] = [];
  let position = 0;
  const token =
    /\{\{\w+\}\}|\*\*[^*]+\*\*|`[^`]+`|\[|https?:\/\/[^\s<>]+|www\.[^\s<>]+|flowrenix\.com|\n/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index < position) continue;
    nodes.push(text.slice(position, match.index));
    let value = match[0];
    let end = token.lastIndex;
    let node: ReactNode = value;
    if (value === "[") {
      let depth = 1;
      while (end < text.length && depth) {
        if (text[end] === "[") depth++;
        if (text[end] === "]") depth--;
        end++;
      }
      value = text.slice(match.index, end);
      const content = (
        <>
          [
          <InlineText
            text={value.slice(1, depth ? undefined : -1)}
            marked
            variablesEnabled={variablesEnabled}
          />
          {depth ? "" : "]"}
        </>
      );
      node = marked ? content : <mark className="placeholder">{content}</mark>;
    } else if (value.startsWith("{{") && variablesEnabled) {
      const key = value.slice(2, -2) as keyof typeof variables;
      const resolved = key in variables ? String(variables[key]) : value;
      const content = <InlineText text={resolved} marked={marked} variablesEnabled={false} />;
      node =
        value === "{{shipping}}" ? (
          <ShippingText />
        ) : key === "email" ? (
          <a href={`mailto:${resolved}`}>{content}</a>
        ) : (
          content
        );
    } else if (value.startsWith("**")) {
      node = (
        <strong>
          <InlineText
            text={value.slice(2, -2)}
            marked={marked}
            variablesEnabled={variablesEnabled}
          />
        </strong>
      );
    } else if (value.startsWith("`")) {
      node = <span className="inline-code">{value.slice(1, -1)}</span>;
    } else if (value === "\n") node = <br />;
    else if (/^(https?:\/\/|www\.|flowrenix\.com)/.test(value)) {
      value = value.replace(/[.,;:!?)]*$/, "");
      end = match.index + value.length;
      node = (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener"
        >
          {value}
        </a>
      );
    }
    nodes.push(<Fragment key={match.index}>{node}</Fragment>);
    position = end;
    token.lastIndex = end;
  }
  nodes.push(text.slice(position));
  return <>{nodes}</>;
}
const TERMS_SENTENCES = [
  "Die verbindlichen Regeln stehen in den AGB.",
  "The binding rules are set out in the terms and conditions.",
];
function Block({ block, shipping }: { block: PageBlock; shipping: boolean }) {
  const t = useT();
  const lp = useLocaleParam();
  if (block.type === "paragraph") {
    return (
      <p>
        {shipping && TERMS_SENTENCES.includes(block.text) ? (
          <>
            {t.content.termsLinkSentence}{" "}
            <Link to="/{-$locale}/agb" params={{ locale: lp }}>
              {t.checkout.termsLink}
            </Link>
            .
          </>
        ) : (
          <InlineText text={block.text} />
        )}
      </p>
    );
  }
  if (block.type === "bullets" || block.type === "steps") {
    const List = block.type === "steps" ? "ol" : "ul";
    return (
      <List>
        {visibleItems(block.items).map((text, i) => (
          <li key={i}>
            <InlineText text={text} />
          </li>
        ))}
      </List>
    );
  }
  if (block.type === "definitions") {
    return (
      <dl className="shipping-definitions">
        {block.items.map((item, i) => (
          <div key={i}>
            <dt>
              <strong>
                <InlineText text={item.label} />
              </strong>
            </dt>
            <dd>
              <InlineText text={item.value} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.type === "questions") {
    return (
      <Accordion type="multiple" className="written-questions">
        {block.items.map((item, i) => (
          <AccordionItem value={String(i)} key={i}>
            <AccordionTrigger>
              <strong>
                <InlineText text={item.question} />
              </strong>
            </AccordionTrigger>
            <AccordionContent>
              <p>
                <InlineText text={item.answer} />
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }
  return null;
}
export function WrittenContent({ page }: { page: WrittenPage }) {
  const t = useT();
  const lp = useLocaleParam();
  const shipping =
    page === pages["versand-und-rueckgabe"] || page === pagesEn["versand-und-rueckgabe"];
  return (
    <div className="written-content">
      {pageHasPlaceholder(page) && <div className="draft-notice">{t.content.draftNotice}</div>}
      {page.sections.map((section, i) => (
        <section key={i}>
          {section.heading && (
            <h2>
              <InlineText text={section.heading} />
            </h2>
          )}
          {section.blocks.map((block, j) => (
            <Block key={j} block={block} shipping={shipping} />
          ))}
        </section>
      ))}
      {shipping && (
        <p className="return-cta">
          <Button asChild>
            <Link to="/{-$locale}/retoure" params={{ locale: lp }}>
              {t.returns.cta}
            </Link>
          </Button>
        </p>
      )}
    </div>
  );
}
