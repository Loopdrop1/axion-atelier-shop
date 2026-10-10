import { createFileRoute, Link } from '@tanstack/react-router';
import { pageHead } from '@/lib/commerce/seo';
import { Button } from '@/components/ui/button';
export const Route=createFileRoute('/$')({head:()=>pageHead('Seite nicht gefunden','Diese Seite wurde nicht gefunden. Entdecke die Kollektion von Axion.'),component:Missing});
function Missing(){return <div className="container page-body"><p className="eyebrow">404</p><h1 className="page-title">Dieses Stück fehlt.</h1><p className="page-intro">Diese Seite wurde nicht gefunden. Entdecke stattdessen unsere Kollektion.</p><div className="empty-links justify-start"><Button asChild><Link to="/kollektion/$handle" params={{handle:'alle'}}>Kollektion entdecken</Link></Button><Button variant="tailored" asChild><Link to="/">Zur Startseite</Link></Button></div></div>;}
