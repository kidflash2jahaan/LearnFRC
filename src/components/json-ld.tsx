export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // structured data is static, server-rendered, and not user-controlled
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
