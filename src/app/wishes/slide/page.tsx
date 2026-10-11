import type { Metadata } from 'next';
import SlideshowClient from '@/components/SlideshowClient';

export const metadata: Metadata = { title: 'Slide show' };
export default function SlidePage() { return <SlideshowClient />; }
