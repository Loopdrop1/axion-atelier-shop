import { motion, useReducedMotion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ShopImage } from '@/lib/commerce';
export function Photo({image,className='',eager=false}:{image:ShopImage|undefined;className?:string;eager?:boolean}) { if(!image)return null;return <img className={className} src={image.url} alt={image.altText} width={image.width} height={image.height} loading={eager?'eager':'lazy'}/>; }
export function Reveal({children,image=false,className=''}:{children:ReactNode;image?:boolean;className?:string}) { const reduced=useReducedMotion(); return <motion.div className={className} initial={reduced?false:image?{clipPath:'inset(100% 0 0 0)'}:{opacity:0,y:16}} whileInView={image?{clipPath:'inset(0% 0 0 0)'}:{opacity:1,y:0}} viewport={{once:true,amount:0.12}} transition={{duration:image?.9:.6,ease:[.22,1,.36,1]}}>{children}</motion.div>; }
export function Panel({open,onOpenChange,title,children,kind='right'}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;children:ReactNode;kind?:'right'|'search'|'menu'|'bottom'|'zoom'}) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="shop-backdrop"/><Dialog.Content className={`shop-panel panel-${kind}`} aria-describedby={undefined}><div className="panel-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><Button variant="icon" size="icon" aria-label="Schliessen"><X/></Button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>; }
