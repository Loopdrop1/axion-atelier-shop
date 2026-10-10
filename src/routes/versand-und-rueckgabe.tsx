import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/lib/commerce/seo';
import { ContentPage,contentPages } from '@/components/shop/content';
export const Route=createFileRoute('/versand-und-rueckgabe')({head:()=>pageHead(contentPages['versand-und-rueckgabe'].title,contentPages['versand-und-rueckgabe'].description),component:Page});
function Page(){return <ContentPage handle='versand-und-rueckgabe'/>;}
