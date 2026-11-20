import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ExportFormat,
  MindstormBoard,
  WickSettings,
  WorkItem,
  WorkKind,
} from './src/types/wick.ts';
import { countWordsFromHtml, exportWork, parseImportedFile } from './server/docFormats.ts';
import { createSeedWorkspace, readWorkspace, writeWorkspace } from './server/storage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function recalcWorkWordCounts(work: WorkItem): WorkItem {
  return {
    ...work,
    chapters: work.chapters.map((ch) => ({
      ...ch,
      wordCount: countWordsFromHtml(ch.contentHtml),
      scenes: ch.scenes.map((sc) => ({
        ...sc,
        wordCount: countWordsFromHtml(sc.contentHtml),
      })),
    })),
  };
}

export async function startServer(options?: {
  port?: number;
  host?: string;
  dataDir?: string;
  isProd?: boolean;
}): Promise<{ server: import('http').Server; port: number }> {
  if (options?.dataDir) {
    process.env.WICK_DATA_DIR = options.dataDir;
  }

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Full workspace bootstrap
  app.get('/api/workspace', async (_req, res) => {
    try {
      const workspace = await readWorkspace();
      res.json(workspace);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load workspace' });
    }
  });

  // Create new document or book
  app.post('/api/works', async (req, res) => {
    try {
      const { title, kind, initialHtml, subtitle } = req.body as {
        title?: string;
        kind?: WorkKind;
        initialHtml?: string;
        subtitle?: string;
      };
      const workspace = await readWorkspace();
      const now = new Date().toISOString();
      const workKind: WorkKind = kind === 'book' ? 'book' : 'document';
      const content = initialHtml || '<p><br></p>';

      const newWork: WorkItem = {
        id: makeId('work'),
        title: (title || '').trim() || (workKind === 'book' ? 'Untitled Book' : 'Untitled Document'),
        subtitle: (subtitle || '').trim(),
        author: workspace.settings.authorName || 'Writer',
        kind: workKind,
        defaultFont: workspace.settings.editorFont,
        direction: workspace.settings.defaultDirection || 'auto',
        chapters: [
          {
            id: makeId('ch'),
            title: workKind === 'book' ? 'Chapter I' : 'Body',
            contentHtml: content,
            wordCount: countWordsFromHtml(content),
            scenes: [],
            updatedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      workspace.works.unshift(newWork);
      await writeWorkspace(workspace);
      res.status(201).json(newWork);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create work' });
    }
  });

  // Update existing work
  app.patch('/api/works/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<WorkItem>;
      const workspace = await readWorkspace();
      const idx = workspace.works.findIndex((w) => w.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Work not found' });
        return;
      }

      const updated = recalcWorkWordCounts({
        ...workspace.works[idx],
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      });
      workspace.works[idx] = updated;
      await writeWorkspace(workspace);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update work' });
    }
  });

  // Delete work
  app.delete('/api/works/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const workspace = await readWorkspace();
      workspace.works = workspace.works.filter((w) => w.id !== id);
      await writeWorkspace(workspace);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete work' });
    }
  });

  // Import file (.txt, .md, .html, .rtf, .doc, .docx, .odt)
  app.post('/api/import', async (req, res) => {
    try {
      const { filename, base64Content, kind } = req.body as {
        filename: string;
        base64Content: string;
        kind?: WorkKind;
      };
      if (!filename || !base64Content) {
        res.status(400).json({ error: 'Missing file payload' });
        return;
      }

      const buffer = Buffer.from(base64Content, 'base64');
      const parsed = await parseImportedFile(filename, buffer);
      const workspace = await readWorkspace();
      const now = new Date().toISOString();
      const workKind: WorkKind = kind === 'book' ? 'book' : 'document';

      const containsArabic = /[\u0600-\u06FF]/.test(`${parsed.title} ${parsed.contentHtml}`);

      const newWork: WorkItem = {
        id: makeId('work'),
        title: parsed.title,
        subtitle: '',
        author: workspace.settings.authorName || 'Writer',
        kind: workKind,
        defaultFont: workspace.settings.editorFont,
        direction: containsArabic ? 'rtl' : workspace.settings.defaultDirection || 'auto',
        chapters: [
          {
            id: makeId('ch'),
            title: workKind === 'book' ? 'Chapter I' : 'Body',
            contentHtml: parsed.contentHtml,
            wordCount: countWordsFromHtml(parsed.contentHtml),
            scenes: [],
            updatedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      workspace.works.unshift(newWork);
      await writeWorkspace(workspace);
      res.status(201).json(newWork);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not import this file format',
      });
    }
  });

  // Export work in chosen format
  app.post('/api/export', async (req, res) => {
    try {
      const { workId, format, chapterId, paperSize, customPaperWidthMm, customPaperHeightMm } =
        req.body as {
          workId: string;
          format: ExportFormat;
          chapterId?: string;
          paperSize?: string;
          customPaperWidthMm?: number;
          customPaperHeightMm?: number;
        };
      const workspace = await readWorkspace();
      const work = workspace.works.find((w) => w.id === workId);
      if (!work) {
        res.status(404).json({ error: 'Work not found' });
        return;
      }
      const presetMap: Record<string, { widthMm: number; heightMm: number }> = {
        a4: { widthMm: 210, heightMm: 297 },
        a5: { widthMm: 148, heightMm: 210 },
        b5: { widthMm: 176, heightMm: 250 },
        letter: { widthMm: 215.9, heightMm: 279.4 },
        legal: { widthMm: 215.9, heightMm: 355.6 },
        executive: { widthMm: 184.2, heightMm: 266.7 },
        trade: { widthMm: 152.4, heightMm: 228.6 },
        digest: { widthMm: 139.7, heightMm: 215.9 },
        royal: { widthMm: 156, heightMm: 234 },
      };
      const resolvedSize = paperSize || workspace.settings.paperSize || 'a4';
      const paperSpec =
        resolvedSize === 'custom'
          ? {
              widthMm: Math.min(500, Math.max(80, Number(customPaperWidthMm ?? workspace.settings.customPaperWidthMm) || 210)),
              heightMm: Math.min(650, Math.max(100, Number(customPaperHeightMm ?? workspace.settings.customPaperHeightMm) || 297)),
            }
          : presetMap[resolvedSize] ?? presetMap.a4;

      const result = await exportWork(work, format, chapterId, paperSpec);
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.utf8Filename)}`,
      );
      res.send(result.buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to export work' });
    }
  });

  // Create Mindstorm board
  app.post('/api/mindstorm', async (req, res) => {
    try {
      const { title, linkedWorkId } = req.body as { title?: string; linkedWorkId?: string };
      const workspace = await readWorkspace();
      const now = new Date().toISOString();
      const board: MindstormBoard = {
        id: makeId('board'),
        title: (title || '').trim() || 'Untitled Board',
        linkedWorkId,
        nodes: [
          {
            id: makeId('node'),
            x: 160,
            y: 120,
            title: '',
            body: '',
            role: 'Free Space',
            tone: 'neutral',
          },
        ],
        edges: [],
        createdAt: now,
        updatedAt: now,
      };
      workspace.mindstormBoards.unshift(board);
      await writeWorkspace(workspace);
      res.status(201).json(board);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create board' });
    }
  });

  // Update Mindstorm board
  app.patch('/api/mindstorm/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<MindstormBoard>;
      const workspace = await readWorkspace();
      const idx = workspace.mindstormBoards.findIndex((b) => b.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Board not found' });
        return;
      }
      const updated: MindstormBoard = {
        ...workspace.mindstormBoards[idx],
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      workspace.mindstormBoards[idx] = updated;
      await writeWorkspace(workspace);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update board' });
    }
  });

  // Delete Mindstorm board
  app.delete('/api/mindstorm/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const workspace = await readWorkspace();
      workspace.mindstormBoards = workspace.mindstormBoards.filter((b) => b.id !== id);
      await writeWorkspace(workspace);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete board' });
    }
  });

  // Log Journey writing words
  app.post('/api/journey/log', async (req, res) => {
    try {
      const { workId, workTitle, wordsAdded, minutes } = req.body as {
        workId: string;
        workTitle: string;
        wordsAdded: number;
        minutes?: number;
      };
      if (!workId || wordsAdded <= 0) {
        res.json({ ok: true });
        return;
      }
      const workspace = await readWorkspace();
      const today = new Date().toISOString().slice(0, 10);
      const existing = workspace.journeySessions.find(
        (s) => s.date === today && s.workId === workId,
      );
      if (existing) {
        existing.wordsAdded += wordsAdded;
        existing.minutes += minutes ?? 1;
        existing.workTitle = workTitle;
      } else {
        workspace.journeySessions.push({
          id: makeId('js'),
          date: today,
          workId,
          workTitle,
          wordsAdded,
          minutes: minutes ?? 2,
        });
      }
      await writeWorkspace(workspace);
      res.json(workspace.journeySessions);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to log session' });
    }
  });

  // Update settings
  app.put('/api/settings', async (req, res) => {
    try {
      const patch = req.body as Partial<WickSettings>;
      const workspace = await readWorkspace();
      workspace.settings = {
        ...workspace.settings,
        ...patch,
      };
      await writeWorkspace(workspace);
      res.json(workspace.settings);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update settings' });
    }
  });

  // Full backup JSON download
  app.get('/api/backup', async (_req, res) => {
    try {
      const workspace = await readWorkspace();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="wick-library-backup.json"');
      res.send(JSON.stringify(workspace, null, 2));
    } catch (err) {
      res.status(500).json({ error: 'Failed to export backup' });
    }
  });

  // Reset to clean sample library
  app.post('/api/reset-sample', async (_req, res) => {
    try {
      const seed = createSeedWorkspace();
      await writeWorkspace(seed);
      res.json(seed);
    } catch (err) {
      res.status(500).json({ error: 'Failed to reset sample workspace' });
    }
  });

  // Return JSON 404 for unknown API paths rather than serving SPA HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  const isProd = options?.isProd ?? process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = fs.existsSync(path.join(__dirname, 'dist'))
      ? path.join(__dirname, 'dist')
      : fs.existsSync(path.join(__dirname, '..', 'dist'))
        ? path.join(__dirname, '..', 'dist')
        : path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const targetPort =
    options?.port !== undefined ? options.port : Number(process.env.PORT) || 3000;
  const targetHost =
    options?.host || (process.env.WICK_LOCAL_ONLY === '1' ? '127.0.0.1' : '0.0.0.0');

  return new Promise((resolve) => {
    const server = app.listen(targetPort, targetHost, () => {
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : targetPort;
      console.log(`WICK desktop server running on http://${targetHost === '0.0.0.0' ? 'localhost' : targetHost}:${boundPort}`);
      resolve({ server, port: boundPort });
    });
  });
}

if (process.env.WICK_NO_AUTO_START !== '1') {
  void startServer();
}
