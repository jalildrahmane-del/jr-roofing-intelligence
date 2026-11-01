export type DailyDraft = {
  version: 1;
  savedAt: string;
  fields: Record<string, string>;
  photos: { image: string; caption: string }[];
};
export const dailyDraftKey = (userId: string, projectId: string) =>
  'jr-daily-draft:' + JSON.stringify([userId, projectId]);
export const dailyFields = ['workerId', 'day', 'operatives', 'workAreas', 'conditions', 'completed', 'delays', 'nextShift'];
export function readDailyDraft(raw: string | null): DailyDraft | null {
  if (raw === null) return null;
  const d = JSON.parse(raw);
  if (!d || d.version !== 1 || typeof d.savedAt !== 'string' || !Number.isFinite(Date.parse(d.savedAt)) ||
      !d.fields || Array.isArray(d.fields) || typeof d.fields !== 'object' ||
      Object.entries(d.fields).some(([key, value]) => !dailyFields.includes(key) || typeof value !== 'string' || value.length > 3000) ||
      !Array.isArray(d.photos) || d.photos.length > 4 || d.photos.some((p: any) =>
        !p || typeof p.caption !== 'string' || p.caption.length > 300 || typeof p.image !== 'string' ||
        p.image.length > 1400000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image)))
    throw Error('Invalid saved daily report');
  return d;
}
