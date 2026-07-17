import { APP_DESCRIPTION, APP_NAME } from '@/_app/metadata/app-metadata';
import { env } from '@/shared/config';

type TJsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: TJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export function WebsiteJsonLd() {
  const baseUrl = env.client.NEXT_PUBLIC_BASE_URL;

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: APP_NAME,
        description: APP_DESCRIPTION,
        url: baseUrl,
      }}
    />
  );
}
