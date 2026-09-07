import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreFromBackup } from './backup';

const upsertMock = vi.fn(async (rows: any[]) => ({ error: null, count: rows.length }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (rows: any[]) => upsertMock(rows),
    }),
  },
  isSupabaseConfigured: true,
}));

function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' });
}

describe('restoreFromBackup', () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  it('rejects a file that is not valid JSON', async () => {
    await expect(restoreFromBackup(makeFile('not json at all'))).rejects.toThrow('الملف ماشي JSON صالح');
  });

  it('rejects JSON that is not a wab-tkd-backup file', async () => {
    const notABackup = JSON.stringify({ hello: 'world' });
    await expect(restoreFromBackup(makeFile(notABackup))).rejects.toThrow('هاذ الملف ماشي نسخة احتياطية صالحة');
  });

  it('rejects a backup file missing its tables payload', async () => {
    const missingTables = JSON.stringify({ kind: 'wab-tkd-backup', version: 1, createdAt: new Date().toISOString() });
    await expect(restoreFromBackup(makeFile(missingTables))).rejects.toThrow('هاذ الملف ماشي نسخة احتياطية صالحة');
  });

  it('restores a valid backup and reports per-table counts', async () => {
    const backup = {
      kind: 'wab-tkd-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      tables: {
        tournaments: [{ id: 't1' }, { id: 't2' }],
        players: [{ id: 'p1' }],
        matches: [],
      },
    };
    const result = await restoreFromBackup(makeFile(JSON.stringify(backup)));
    expect(result.tournaments).toEqual({ restored: 2, failed: 0 });
    expect(result.players).toEqual({ restored: 1, failed: 0 });
    expect(result.matches).toBeUndefined();
  });

  it('counts a table as failed (not thrown) when the upsert itself errors', async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: 'RLS violation' }, count: null } as any);
    const backup = {
      kind: 'wab-tkd-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      tables: { tournaments: [{ id: 't1' }] },
    };
    const result = await restoreFromBackup(makeFile(JSON.stringify(backup)));
    expect(result.tournaments).toEqual({ restored: 0, failed: 1 });
  });
});
