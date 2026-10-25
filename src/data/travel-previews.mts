import { createHash } from 'node:crypto';
import previews from './travel-previews.json';

export type TravelPreview = { url: string; width: number; height: number };
export const travelPreviewKey = (sources: string[]) => createHash('sha256').update(JSON.stringify(['travel-preview-v1-1200-gap6-jpeg86', ...sources])).digest('hex');
export const getTravelPreview = (sources: string[]) => (previews as Record<string, TravelPreview>)[travelPreviewKey(sources)];
