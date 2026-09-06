/**
 * One schema.org graph, printed into the page as a JSON-LD script tag.
 *
 * Every caller builds `data` on the server out of the page's own content and
 * hand-authored constants, so nothing a visitor typed reaches this string and
 * serialising it straight into the script body is safe. Pages render this more
 * than once when they publish several graphs, like a lesson that is both a
 * Course and a BreadcrumbList.
 *
 * It draws nothing. There is no notebook styling here because there is no
 * surface to style: the tag is invisible to a reader and exists only for
 * crawlers.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
