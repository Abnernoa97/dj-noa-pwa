import { db } from './db';
import type { EventItem, EventPhoto, ReminderItem, SheetColumn, SheetPhoto, SheetRow } from './types';

type EncodedPhoto = Omit<EventPhoto, 'blob'> & { dataUrl: string };
type EncodedSheetPhoto = Omit<SheetPhoto, 'blob'> & { dataUrl: string };

type DjNoaBackup = {
  format: 'dj-noa-backup';
  version: 1;
  exportedAt: string;
  data: {
    events: EventItem[];
    eventPhotos: EncodedPhoto[];
    reminders: ReminderItem[];
    sheetRows: SheetRow[];
    sheetColumns: SheetColumn[];
    sheetPhotos: EncodedSheetPhoto[];
    history: unknown[];
  };
};

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('photo_read_failed'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(dataUrl);
  if (!match) throw new Error('invalid_photo_data');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
}

export async function buildDjNoaBackup(): Promise<DjNoaBackup> {
  const [events, eventPhotos, reminders, sheetRows, sheetColumns, sheetPhotos, history] = await Promise.all([
    db.events.toArray(),
    db.eventPhotos.toArray(),
    db.reminders.toArray(),
    db.sheetRows.toArray(),
    db.sheetColumns.toArray(),
    db.sheetPhotos.toArray(),
    db.history.toArray()
  ]);

  const encodedEventPhotos: EncodedPhoto[] = [];
  for (const photo of eventPhotos) {
    const { blob, ...rest } = photo;
    encodedEventPhotos.push({ ...rest, dataUrl: await blobToDataUrl(blob) });
  }

  const encodedSheetPhotos: EncodedSheetPhoto[] = [];
  for (const photo of sheetPhotos) {
    const { blob, ...rest } = photo;
    encodedSheetPhotos.push({ ...rest, dataUrl: await blobToDataUrl(blob) });
  }

  return {
    format: 'dj-noa-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { events, eventPhotos: encodedEventPhotos, reminders, sheetRows, sheetColumns, sheetPhotos: encodedSheetPhotos, history }
  };
}

export async function downloadDjNoaBackup() {
  const backup = await buildDjNoaBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `DJ-NOA-BACKUP-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isBackup(value: unknown): value is DjNoaBackup {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DjNoaBackup>;
  return candidate.format === 'dj-noa-backup' && candidate.version === 1 && Boolean(candidate.data);
}

export async function restoreDjNoaBackup(file: File) {
  const raw = JSON.parse(await file.text()) as unknown;
  if (!isBackup(raw)) throw new Error('invalid_backup');

  const eventPhotos: EventPhoto[] = raw.data.eventPhotos.map((photo) => {
    const { dataUrl, ...rest } = photo;
    return { ...rest, blob: dataUrlToBlob(dataUrl) };
  });
  const sheetPhotos: SheetPhoto[] = raw.data.sheetPhotos.map((photo) => {
    const { dataUrl, ...rest } = photo;
    return { ...rest, blob: dataUrlToBlob(dataUrl) };
  });

  await db.transaction(
    'rw',
    db.events,
    db.eventPhotos,
    db.reminders,
    db.sheetRows,
    db.sheetColumns,
    db.sheetPhotos,
    db.history,
    async () => {
      await Promise.all([
        db.events.clear(),
        db.eventPhotos.clear(),
        db.reminders.clear(),
        db.sheetRows.clear(),
        db.sheetColumns.clear(),
        db.sheetPhotos.clear(),
        db.history.clear()
      ]);
      if (raw.data.events.length) await db.events.bulkPut(raw.data.events);
      if (eventPhotos.length) await db.eventPhotos.bulkPut(eventPhotos);
      if (raw.data.reminders.length) await db.reminders.bulkPut(raw.data.reminders);
      if (raw.data.sheetRows.length) await db.sheetRows.bulkPut(raw.data.sheetRows);
      if (raw.data.sheetColumns.length) await db.sheetColumns.bulkPut(raw.data.sheetColumns);
      if (sheetPhotos.length) await db.sheetPhotos.bulkPut(sheetPhotos);
      if (raw.data.history.length) await db.history.bulkPut(raw.data.history as never[]);
    }
  );

  return {
    events: raw.data.events.length,
    reminders: raw.data.reminders.length,
    rows: raw.data.sheetRows.length,
    photos: eventPhotos.length + sheetPhotos.length
  };
}
