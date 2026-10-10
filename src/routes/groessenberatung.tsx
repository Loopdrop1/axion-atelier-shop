import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/lib/commerce/seo';
import { ContentPage,contentPages } from '@/components/shop/content';
export const Route=createFileRoute('/groessenberatung')({head:()=>pageHead(contentPages['groessenberatung'].title,contentPages['groessenberatung'].description),component:Page});
function Page(){return <ContentPage handle='groessenberatung'/>;}
