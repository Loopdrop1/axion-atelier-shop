import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale } from "@/i18n";
import { homeQuery } from "@/lib/commerce/queries";
import { pageHead } from "@/lib/commerce/seo";
import { HomePage } from "@/components/shop/home";
export const Route = createFileRoute("/{-$locale}/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(homeQuery(toLocale(params.locale))),
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    return pageHead(
      messages[locale].seo.homeTitle,
      messages[locale].seo.homeDescription,
      "/",
      locale,
    );
  },
  component: Index,
});
function Index() {
  const locale = useLocale();
  // Startwert aus dem Loader (vom Server mitgeschickt): Server und Browser hydrieren mit denselben Daten,
  // auch wenn der Server-Zwischenspeicher (30 s) nach einer Änderung im Admin noch den alten Stand hat.
  const { data } = useSuspenseQuery({ ...homeQuery(locale), initialData: Route.useLoaderData() });
  return <HomePage {...data} />;
}
