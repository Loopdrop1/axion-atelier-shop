import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/lib/commerce/seo';
import { ContentPage,contentPages } from '@/components/shop/content';
export const Route=createFileRoute('/impressum')({head:()=>pageHead(contentPages['impressum'].title,contentPages['impressum'].description),component:Page});
function Page(){return <ContentPage handle='impressum'/>;}
