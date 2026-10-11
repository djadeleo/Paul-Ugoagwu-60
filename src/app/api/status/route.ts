import { siteConfig } from '@site';
import { GB, isClosed } from '@/lib/config-helpers';
import { json, usedBytes } from '@/lib/security';

export async function GET() {
  const used = await usedBytes();
  return json(
    { closed: isClosed(), videosOpen: used < siteConfig.limits.videoCloseAtGB * GB },
    200,
    { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  );
}
