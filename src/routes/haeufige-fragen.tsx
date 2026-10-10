import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/lib/commerce/seo';
import { ContentPage,contentPages } from '@/components/shop/content';
export const Route=createFileRoute('/haeufige-fragen')({head:()=>pageHead(contentPages['haeufige-fragen'].title,contentPages['haeufige-fragen'].description),component:Page});
function Page(){return <ContentPage handle='haeufige-fragen'/>;}
