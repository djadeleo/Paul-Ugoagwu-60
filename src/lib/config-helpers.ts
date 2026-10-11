import { siteConfig } from '@site';

export const MB = 1024 * 1024;
export const GB = 1024 * MB;

export const isClosed = () =>
  !!siteConfig.wishesCloseDate && Date.now() > new Date(siteConfig.wishesCloseDate).getTime();

export const baseType = (t: string) => t.split(';')[0].trim().toLowerCase();

export const EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const fmtBytes = (n: number) =>
  n >= GB ? `${(n / GB).toFixed(2)} GB` : n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
