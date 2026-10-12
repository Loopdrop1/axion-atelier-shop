import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { messages, toLocale, useLocale } from "@/i18n";
import { homeQuery } from "@/lib/commerce/queries";
import { pageHead } from "@/lib/commerce/seo";
import { HomePage } from "@/components/shop/home";
export const Route = createFileRoute("/{-$locale}/")({
  head: ({ params }) => {
    const locale = toLocale(params.locale);
    return pageHead(
      messages[locale].seo.homeTitle,
      messages[locale].seo.homeDescription,
      "/",
      locale,
    );
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(homeQuery(toLocale(params.locale))),
  component: Index,
});
function Index() {
  const locale = useLocale();
  const { data } = useSuspenseQuery(homeQuery(locale));
  return <HomePage {...data} />;
}
