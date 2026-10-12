/** JSON für <script type="application/ld+json">. «<» sowie U+2028 und U+2029 werden maskiert, damit Texte aus dem
 *  Admin (z. B. «</script>» in einer Produktbeschreibung) das Script-Tag nicht beenden können. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
