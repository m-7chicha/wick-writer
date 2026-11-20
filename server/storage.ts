import fs from 'fs/promises';
import path from 'path';
import type { WickWorkspaceData } from '../src/types/wick.ts';
import { countWordsFromHtml } from './docFormats.ts';

function getDataDir(): string {
  return process.env.WICK_DATA_DIR || path.join(process.cwd(), 'data');
}

function getWorkspaceFile(): string {
  return path.join(getDataDir(), 'wick-workspace.json');
}

function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function hoursAgoIso(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 3600 * 1000);
  return d.toISOString();
}

export function createSeedWorkspace(): WickWorkspaceData {
  const ch1Html = `<p>The harbor lantern always burned half an hour before sunset, even when the mist lay so thick across the breakwater that no trawler could see past the pilings.</p><p>Clara stood at the window of the watchhouse with her coat still buttoned, listening to the slow metallic tick of the brass pendulum behind her. For three winters she had recorded every tide and every incoming hull in the leather ledger on her desk, yet tonight the ink had dried before she touched nib to paper.</p><blockquote>"Nothing arrives on schedule in November," her father used to remind her, "least of all the things we wait for."</blockquote><p>Down by the stone steps, someone struck a match. The brief amber flare caught the wet salt on the railing, and for a heartbeat she saw the shape of a courier's satchel slung across a narrow shoulder.</p>`;

  const ch2Html = `<p>The envelope carried no postmark—only a wax impression of an astrolabe, cracked cleanly down the meridian.</p><p>Inside lay two folded sheets of vellum and a brass key no longer than Clara's thumb. The handwriting slanted steeply toward the margin, written in haste on a rolling deck:</p><p><em>Keep the upper lens dark after midnight on Thursday. If the harbourmaster asks, tell him the wick gave out before the storm cleared.</em></p>`;

  const ch3Html = `<p>By dawn the fog had lifted into thin silver ribbons along the hills. Clara locked the watchhouse from the outside and walked down toward the drydock, where the hull of the <em>Meridian</em> rested against timber shores.</p><p>No one stirred along the wharf. Only the gulls wheeled slowly over the empty slipway, crying out as the first clear light warmed the slate roofs of the town.</p>`;

  const morningPagesHtml = `<p>There is a quiet quarter-hour right after waking when the critical voice has not yet finished tying its shoes. Sentences written in that window rarely look polished, and that is precisely their gift.</p><p>When the page stays dark and warm instead of stark white, the eye settles. You stop auditing every comma and begin listening for the cadence of the next line.</p>`;

  const writingTestHtml = `<p>This is a spare sheet for testing pacing, dialogue rhythm, and typography before folding scenes into a larger manuscript.</p><p>Try selecting any passage here to format it visually—change the typeface, adjust emphasis, or switch on Living Light to let everything outside the sentence fade quietly back.</p>`;

  return {
    works: [
      {
        id: 'work-glass-lantern',
        title: 'The Glass Lantern',
        subtitle: 'A Novel of the Northern Watchhouse',
        author: 'E. Mercer',
        kind: 'book',
        defaultFont: 'lora',
        chapters: [
          {
            id: 'ch-1',
            title: 'Chapter I · Harbor Fog',
            contentHtml: ch1Html,
            wordCount: countWordsFromHtml(ch1Html),
            scenes: [
              {
                id: 'sc-1-1',
                title: 'Scene 2 · The Courier at the Steps',
                contentHtml:
                  '<p>The footsteps stopped halfway up the wet granite stair. Clara set the lantern low on the sill so the glass would not throw her shadow across the doorway.</p>',
                wordCount: 27,
                updatedAt: hoursAgoIso(5),
              },
            ],
            updatedAt: hoursAgoIso(5),
          },
          {
            id: 'ch-2',
            title: 'Chapter II · Letters from the Quay',
            contentHtml: ch2Html,
            wordCount: countWordsFromHtml(ch2Html),
            scenes: [],
            updatedAt: hoursAgoIso(28),
          },
          {
            id: 'ch-3',
            title: 'Chapter III · The Drydock at Dawn',
            contentHtml: ch3Html,
            wordCount: countWordsFromHtml(ch3Html),
            scenes: [],
            updatedAt: hoursAgoIso(74),
          },
        ],
        createdAt: hoursAgoIso(240),
        updatedAt: hoursAgoIso(5),
      },
      {
        id: 'work-morning-pages',
        title: 'Notes on Quiet Morning Pages',
        subtitle: 'Personal Essay',
        author: 'E. Mercer',
        kind: 'document',
        defaultFont: 'source-serif',
        chapters: [
          {
            id: 'doc-mp-1',
            title: 'Body',
            contentHtml: morningPagesHtml,
            wordCount: countWordsFromHtml(morningPagesHtml),
            scenes: [],
            updatedAt: hoursAgoIso(18),
          },
        ],
        createdAt: hoursAgoIso(120),
        updatedAt: hoursAgoIso(18),
      },
      {
        id: 'work-writing-test',
        title: 'Writing Test',
        subtitle: '',
        author: 'E. Mercer',
        kind: 'document',
        defaultFont: 'lora',
        chapters: [
          {
            id: 'doc-wt-1',
            title: 'Body',
            contentHtml: writingTestHtml,
            wordCount: countWordsFromHtml(writingTestHtml),
            scenes: [],
            updatedAt: hoursAgoIso(46),
          },
        ],
        createdAt: hoursAgoIso(90),
        updatedAt: hoursAgoIso(46),
      },
    ],
    mindstormBoards: [
      {
        id: 'board-lantern-act2',
        title: 'The Glass Lantern — Act II',
        linkedWorkId: 'work-glass-lantern',
        nodes: [
          {
            id: 'node-1',
            x: 110,
            y: 90,
            title: 'Clara Mercer',
            body: 'Keeper of the northern watchhouse. Keeps meticulous tide logs but hides her father’s old charts beneath the floorboards.',
            role: 'Character',
            tone: 'amber',
          },
          {
            id: 'node-2',
            x: 470,
            y: 80,
            title: 'The Thursday Blackout',
            body: 'Why must the upper lens stay dark after midnight? Does a vessel slip past the shoals without signaling the harbourmaster?',
            role: 'Question',
            tone: 'violet',
          },
          {
            id: 'node-3',
            x: 290,
            y: 310,
            title: 'Brass Astrolabe Key',
            body: 'Opens the chart chest aboard the Meridian—or the sea-gate beneath the old customs house.',
            role: 'Free Space',
            tone: 'neutral',
          },
          {
            id: 'node-4',
            x: 660,
            y: 280,
            title: 'Storm Breaks at Low Tide',
            body: 'Harbourmaster arrives with two constables just as Clara extinguishes the wick.',
            role: 'Scene Beat',
            tone: 'amber',
          },
        ],
        edges: [
          { id: 'edge-1', fromId: 'node-1', toId: 'node-2' },
          { id: 'edge-2', fromId: 'node-1', toId: 'node-3' },
          { id: 'edge-3', fromId: 'node-2', toId: 'node-4' },
          { id: 'edge-4', fromId: 'node-3', toId: 'node-4' },
        ],
        createdAt: hoursAgoIso(100),
        updatedAt: hoursAgoIso(6),
      },
      {
        id: 'board-loose-sparks',
        title: 'Loose Sparks & Opening Lines',
        nodes: [
          {
            id: 'node-ls-1',
            x: 140,
            y: 120,
            title: 'Rain on Slate',
            body: 'Start a chapter with the sound before anyone speaks—kettle, rain, a distant ferry horn.',
            role: 'Free Space',
            tone: 'neutral',
          },
        ],
        edges: [],
        createdAt: hoursAgoIso(60),
        updatedAt: hoursAgoIso(60),
      },
    ],
    journeySessions: [
      { id: 'js-1', date: daysAgoIso(19), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 420, minutes: 28 },
      { id: 'js-2', date: daysAgoIso(17), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 680, minutes: 42 },
      { id: 'js-3', date: daysAgoIso(15), workId: 'work-morning-pages', workTitle: 'Notes on Quiet Morning Pages', wordsAdded: 310, minutes: 19 },
      { id: 'js-4', date: daysAgoIso(12), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 910, minutes: 55 },
      { id: 'js-5', date: daysAgoIso(10), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 540, minutes: 34 },
      { id: 'js-6', date: daysAgoIso(7), workId: 'work-writing-test', workTitle: 'Writing Test', wordsAdded: 245, minutes: 16 },
      { id: 'js-7', date: daysAgoIso(4), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 790, minutes: 48 },
      { id: 'js-8', date: daysAgoIso(2), workId: 'work-morning-pages', workTitle: 'Notes on Quiet Morning Pages', wordsAdded: 360, minutes: 22 },
      { id: 'js-9', date: daysAgoIso(0), workId: 'work-glass-lantern', workTitle: 'The Glass Lantern', wordsAdded: 295, minutes: 20 },
    ],
    settings: {
      theme: 'obsidian',
      livingLightEnabled: true,
      livingLightIntensity: 68,
      editorFont: 'lora',
      editorFontSize: 18,
      editorMeasure: 'balanced',
      defaultDirection: 'auto',
      defaultLineHeight: 1.75,
      defaultLetterSpacing: 0,
      paperSize: 'a4',
      customPaperWidthMm: 210,
      customPaperHeightMm: 297,
      showWordCountWhileTyping: true,
      autosaveMs: 900,
      authorName: 'E. Mercer',
    },
  };
}

let writeQueue: Promise<void> = Promise.resolve();

export async function readWorkspace(): Promise<WickWorkspaceData> {
  try {
    const dataDir = getDataDir();
    const workspaceFile = getWorkspaceFile();
    await fs.mkdir(dataDir, { recursive: true });
    const raw = await fs.readFile(workspaceFile, 'utf8');
    const parsed = JSON.parse(raw) as WickWorkspaceData;
    const defaults = createSeedWorkspace().settings;
    return {
      ...parsed,
      settings: {
        ...defaults,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    const seed = createSeedWorkspace();
    await writeWorkspace(seed);
    return seed;
  }
}

export async function writeWorkspace(data: WickWorkspaceData): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const dataDir = getDataDir();
    const workspaceFile = getWorkspaceFile();
    await fs.mkdir(dataDir, { recursive: true });
    const tmpFile = path.join(dataDir, `wick-workspace.${Date.now()}.tmp`);
    await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmpFile, workspaceFile);
  });
  return writeQueue;
}
