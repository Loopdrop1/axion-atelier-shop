import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { shopConfig } from "@/config/shop";
import { pages, type PageBlock, type WrittenPage } from "@/content/pages";

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
  return text.replace(/\{\{(\w+)\}\}/g, (token, key: string) => key in variables ? String(variables[key as keyof typeof variables]) : token);
}
export function pageHasPlaceholder(page: WrittenPage) {
  return /\[/.test(resolvePageVariables(JSON.stringify(page)));
}

export function InlineText({ text, marked = false, variablesEnabled = true }: { text: string; marked?: boolean; variablesEnabled?: boolean }) {
  const nodes: ReactNode[] = [];
  let position = 0;
  const token = /\{\{\w+\}\}|\*\*[^*]+\*\*|`[^`]+`|\[|https?:\/\/[^\s<>]+|www\.[^\s<>]+|flowrenix\.com|\n/g;
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
      node = marked ? value : <mark className="placeholder"><InlineText text={value.slice(1, depth ? undefined : -1)} marked variablesEnabled={variablesEnabled} />{depth ? "" : "]"}</mark>;
      // Keep the opening bracket visible, including nested config placeholders.
      if (!marked) node = <mark className="placeholder">[<InlineText text={value.slice(1, depth ? undefined : -1)} marked variablesEnabled={variablesEnabled} />{depth ? "" : "]"}</mark>;
    } else if (value.startsWith("{{") && variablesEnabled) {
      const key = value.slice(2, -2) as keyof typeof variables;
      const resolved = key in variables ? String(variables[key]) : value;
      const content = <InlineText text={resolved} marked={marked} variablesEnabled={false} />;
      node = key === "email" ? <a href={`mailto:${resolved}`}>{content}</a> : content;
    } else if (value.startsWith("**")) {
      node = <strong><InlineText text={value.slice(2, -2)} marked={marked} variablesEnabled={variablesEnabled} /></strong>;
    } else if (value.startsWith("`")) {
      node = <span className="inline-code">{value.slice(1, -1)}</span>;
    } else if (value === "\n") node = <br />;
    else if (/^(https?:\/\/|www\.|flowrenix\.com)/.test(value)) {
      value = value.replace(/[.,;:!?)]*$/, "");
      end = match.index + value.length;
      node = <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener">{value}</a>;
    }
    nodes.push(<Fragment key={match.index}>{node}</Fragment>);
    position = end;
    token.lastIndex = end;
  }
  nodes.push(text.slice(position));
  return <>{nodes}</>;
}
function Block({ block, shipping }: { block: PageBlock; shipping: boolean }) {
  if (block.type === "paragraph") {
    return <p>{shipping && block.text === "Die verbindlichen Regeln stehen in den AGB." ? <>Die verbindlichen Regeln stehen in den <Link to="/agb">AGB</Link>.</> : <InlineText text={block.text} />}</p>;
  }
  if (block.type === "bullets" || block.type === "steps") {
    const List = block.type === "steps" ? "ol" : "ul";
    return <List>{block.items.map((text, i) => <li key={i}><InlineText text={text} /></li>)}</List>;
  }
  if (block.type === "definitions") {
    return <dl className="shipping-definitions">{block.items.map((item, i) => <div key={i}><dt><strong><InlineText text={item.label} /></strong></dt><dd><InlineText text={item.value} /></dd></div>)}</dl>;
  }
  if (block.type === "questions") {
    return <Accordion type="multiple" className="written-questions">{block.items.map((item, i) => <AccordionItem value={String(i)} key={i}><AccordionTrigger><strong><InlineText text={item.question} /></strong></AccordionTrigger><AccordionContent><p><InlineText text={item.answer} /></p></AccordionContent></AccordionItem>)}</Accordion>;
  }
  return null;
}
export function WrittenContent({ page }: { page: WrittenPage }) {
  return <div className="written-content">
    {pageHasPlaceholder(page) && <div className="draft-notice">Entwurf: Angaben in eckigen Klammern werden vor dem Livegang ergänzt.</div>}
    {page.sections.map((section, i) => <section key={i}>
      {section.heading && <h2><InlineText text={section.heading} /></h2>}
      {section.blocks.map((block, j) => <Block key={j} block={block} shipping={page === pages["versand-und-rueckgabe"]} />)}
    </section>)}
  </div>;
}
