import JSZip from 'jszip';
import type { ChapterItem, ExportFormat, WorkItem } from '../src/types/wick.ts';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function countWordsFromHtml(html: string): number {
  const plain = stripHtmlToText(html);
  if (!plain) return 0;
  const matches = plain.match(/\S+/g);
  return matches ? matches.length : 0;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  const formatInline = (line: string): string => {
    let s = escapeHtml(line);
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<u>$1</u>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/_(.+?)_/g, '<em>$1</em>');
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
    return s;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeLists();
      continue;
    }
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      closeLists();
      out.push('<p style="text-align: center;">* * *</p>');
      continue;
    }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      closeLists();
      out.push(`<h3>${formatInline(h3[1])}</h3>`);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      closeLists();
      out.push(`<h2>${formatInline(h2[1])}</h2>`);
      continue;
    }
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) {
      closeLists();
      out.push(`<h1>${formatInline(h1[1])}</h1>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)/);
    if (quote) {
      closeLists();
      out.push(`<blockquote>${formatInline(quote[1])}</blockquote>`);
      continue;
    }
    const ul = line.match(/^[-*+]\s+(.+)/);
    if (ul) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${formatInline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.+)/);
    if (ol) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${formatInline(ol[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${formatInline(line)}</p>`);
  }
  closeLists();
  return out.length > 0 ? out.join('\n') : '<p><br></p>';
}

function rtfToHtml(rtf: string): string {
  // Clean lightweight RTF parser preserving paragraphs, bold, italic, underline
  let i = 0;
  const len = rtf.length;
  interface RtfState {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    skip: boolean;
  }
  const stack: RtfState[] = [{ bold: false, italic: false, underline: false, skip: false }];
  let current: RtfState = { bold: false, italic: false, underline: false, skip: false };
  const paragraphs: string[] = [];
  let currentPara = '';

  const skipGroups = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'headerl',
    'headerr',
    'headerf',
    'footerl',
    'footerr',
    'footerf',
    'fldinst',
  ]);

  const appendStyled = (text: string) => {
    if (current.skip || !text) return;
    let chunk = escapeHtml(text);
    if (current.underline) chunk = `<u>${chunk}</u>`;
    if (current.italic) chunk = `<em>${chunk}</em>`;
    if (current.bold) chunk = `<strong>${chunk}</strong>`;
    currentPara += chunk;
  };

  while (i < len) {
    const ch = rtf[i];
    if (ch === '{') {
      stack.push({ ...current });
      i++;
      continue;
    }
    if (ch === '}') {
      current = stack.pop() ?? { bold: false, italic: false, underline: false, skip: false };
      i++;
      continue;
    }
    if (ch === '\\') {
      i++;
      if (i >= len) break;
      const next = rtf[i];
      if (next === '\\' || next === '{' || next === '}') {
        appendStyled(next);
        i++;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 1, i + 3);
        const code = parseInt(hex, 16);
        if (!Number.isNaN(code)) {
          appendStyled(String.fromCharCode(code));
        }
        i += 3;
        continue;
      }
      if (next === '*') {
        current.skip = true;
        i++;
        continue;
      }
      if (next === '~') {
        appendStyled(' ');
        i++;
        continue;
      }
      if (next === '\n' || next === '\r') {
        paragraphs.push(currentPara);
        currentPara = '';
        i++;
        continue;
      }
      const match = rtf.slice(i).match(/^([a-zA-Z]+)(-?\d+)?\s?/);
      if (match) {
        const word = match[1];
        const param = match[2];
        i += match[0].length;
        if (skipGroups.has(word)) {
          current.skip = true;
        } else if (word === 'par' || word === 'line') {
          if (!current.skip) {
            paragraphs.push(currentPara);
            currentPara = '';
          }
        } else if (word === 'tab') {
          appendStyled('    ');
        } else if (word === 'b') {
          current.bold = param !== '0';
        } else if (word === 'i') {
          current.italic = param !== '0';
        } else if (word === 'ul') {
          current.underline = param !== '0';
        } else if (word === 'ulnone') {
          current.underline = false;
        } else if (word === 'plain') {
          current.bold = false;
          current.italic = false;
          current.underline = false;
        } else if (word === 'u' && param) {
          const code = Number(param);
          const charCode = code < 0 ? code + 65536 : code;
          appendStyled(String.fromCharCode(charCode));
          // skip replacement char
          if (rtf[i] === '?') i++;
        }
      } else {
        i++;
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    appendStyled(ch);
    i++;
  }

  if (currentPara.trim()) {
    paragraphs.push(currentPara);
  }
  const html = paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('\n');
  return html || '<p><br></p>';
}

async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Invalid .docx archive: missing word/document.xml');
  }
  const xml = await docFile.async('string');
  const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const out: string[] = [];

  let pMatch: RegExpExecArray | null;
  while ((pMatch = paraRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    const pStyleMatch = pContent.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const styleVal = pStyleMatch ? pStyleMatch[1].toLowerCase() : '';
    const isList = /<w:numPr>/.test(pContent);

    const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let runMatch: RegExpExecArray | null;
    let innerHtml = '';
    while ((runMatch = runRegex.exec(pContent)) !== null) {
      const rXml = runMatch[1];
      const isBold = /<w:b(?:\s+w:val="(?:1|true)")?\s*\/>/.test(rXml);
      const isItalic = /<w:i(?:\s+w:val="(?:1|true)")?\s*\/>/.test(rXml);
      const isUnderline = /<w:u\b(?![^>]*w:val="none")/.test(rXml);

      const textMatches = [...rXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g)];
      const hasBr = /<w:br\s*\/>/.test(rXml);
      const hasTab = /<w:tab\s*\/>/.test(rXml);

      let text = textMatches.map((m) => decodeXmlEntities(m[1])).join('');
      if (hasTab) text = '    ' + text;
      let chunk = escapeHtml(text);
      if (chunk) {
        if (isUnderline) chunk = `<u>${chunk}</u>`;
        if (isItalic) chunk = `<em>${chunk}</em>`;
        if (isBold) chunk = `<strong>${chunk}</strong>`;
        innerHtml += chunk;
      }
      if (hasBr) innerHtml += '<br>';
    }

    if (!innerHtml.trim()) continue;

    if (styleVal.includes('heading1') || styleVal === 'title') {
      out.push(`<h1>${innerHtml}</h1>`);
    } else if (styleVal.includes('heading2') || styleVal === 'subtitle') {
      out.push(`<h2>${innerHtml}</h2>`);
    } else if (styleVal.includes('heading3')) {
      out.push(`<h3>${innerHtml}</h3>`);
    } else if (styleVal.includes('quote')) {
      out.push(`<blockquote>${innerHtml}</blockquote>`);
    } else if (isList) {
      out.push(`<p>• ${innerHtml}</p>`);
    } else {
      out.push(`<p>${innerHtml}</p>`);
    }
  }

  return out.length > 0 ? out.join('\n') : '<p><br></p>';
}

async function parseOdtBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) {
    throw new Error('Invalid .odt archive: missing content.xml');
  }
  const xml = await contentFile.async('string');

  // Inspect automatic styles for bold/italic/underline style names
  const boldStyles = new Set<string>();
  const italicStyles = new Set<string>();
  const underlineStyles = new Set<string>();
  const styleRegex = /<style:style\b[^>]*style:name="([^"]+)"[^>]*>([\s\S]*?)<\/style:style>/g;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = styleRegex.exec(xml)) !== null) {
    const name = sMatch[1];
    const body = sMatch[2];
    if (/fo:font-weight="bold"/.test(body)) boldStyles.add(name);
    if (/fo:font-style="italic"/.test(body)) italicStyles.add(name);
    if (/style:text-underline-style="solid"/.test(body)) underlineStyles.add(name);
  }

  const blockRegex = /<(text:h|text:p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  const out: string[] = [];
  let bMatch: RegExpExecArray | null;

  const parseInlineOdt = (raw: string): string => {
    const withSpans = raw.replace(
      /<text:span\b[^>]*text:style-name="([^"]+)"[^>]*>([\s\S]*?)<\/text:span>/g,
      (_, styleName: string, inner: string) => {
        let content = parseInlineOdt(inner);
        if (underlineStyles.has(styleName)) content = `<u>${content}</u>`;
        if (italicStyles.has(styleName)) content = `<em>${content}</em>`;
        if (boldStyles.has(styleName)) content = `<strong>${content}</strong>`;
        return content;
      },
    );
    return withSpans
      .replace(/<text:line-break\s*\/>/g, '<br>')
      .replace(/<text:tab\s*\/>/g, '    ')
      .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, c) => ' '.repeat(Number(c || 1)))
      .replace(/<(?!\/?(?:strong|em|u|br)\b)[^>]+>/g, '');
  };

  while ((bMatch = blockRegex.exec(xml)) !== null) {
    const tag = bMatch[1];
    const attrs = bMatch[2];
    const inner = decodeXmlEntities(parseInlineOdt(bMatch[3])).trim();
    if (!inner) continue;
    if (tag === 'text:h') {
      const levelMatch = attrs.match(/text:outline-level="(\d+)"/);
      const lvl = Math.min(3, Math.max(1, Number(levelMatch?.[1] || 1)));
      out.push(`<h${lvl}>${inner}</h${lvl}>`);
    } else {
      out.push(`<p>${inner}</p>`);
    }
  }

  return out.length > 0 ? out.join('\n') : '<p><br></p>';
}

function sanitizeImportedHtml(rawHtml: string): string {
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : rawHtml;
  const cleaned = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?!\/?(?:p|br|h1|h2|h3|h4|strong|b|em|i|u|s|blockquote|ul|ol|li|div)\b)[^>]+>/gi, '')
    .replace(/<\/?div[^>]*>/gi, (m) => (m.startsWith('</') ? '</p>' : '<p>'))
    .replace(/\s+(class|style|id|data-[\w-]+)="[^"]*"/gi, '')
    .trim();
  return cleaned || '<p><br></p>';
}

function parseLegacyDocBuffer(buffer: Buffer): string {
  const asUtf8 = buffer.toString('utf8');
  if (/<html[\s>]/i.test(asUtf8) || /<body[\s>]/i.test(asUtf8)) {
    return sanitizeImportedHtml(asUtf8);
  }
  if (/^\{\\rtf/i.test(asUtf8.trimStart())) {
    return rtfToHtml(asUtf8);
  }
  // Binary legacy .doc fallback: extract readable ASCII/UTF-16LE runs cleanly
  const utf16Runs = buffer.toString('utf16le').match(/[\x20-\x7E\u00A0-\u024F\r\n\t]{16,}/g) ?? [];
  const asciiRuns = buffer.toString('latin1').match(/[\x20-\x7E\r\n\t]{20,}/g) ?? [];
  const best = utf16Runs.join('\n').length > asciiRuns.join('\n').length ? utf16Runs : asciiRuns;
  const text = best
    .join('\n')
    .replace(/[^\x20-\x7E\u00A0-\u024F\r\n\t]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (!text) {
    return '<p>Imported document could not recover readable text from this legacy binary .doc file. Try saving as .docx, .odt, or .rtf.</p>';
  }
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export async function parseImportedFile(
  filename: string,
  buffer: Buffer,
): Promise<{ title: string; contentHtml: string }> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt';
  const baseTitle = filename.replace(/\.[^.]+$/, '').trim() || 'Imported Document';

  if (ext === 'docx') {
    return { title: baseTitle, contentHtml: await parseDocxBuffer(buffer) };
  }
  if (ext === 'odt') {
    return { title: baseTitle, contentHtml: await parseOdtBuffer(buffer) };
  }
  if (ext === 'doc') {
    return { title: baseTitle, contentHtml: parseLegacyDocBuffer(buffer) };
  }
  if (ext === 'rtf') {
    return { title: baseTitle, contentHtml: rtfToHtml(buffer.toString('utf8')) };
  }
  if (ext === 'html' || ext === 'htm') {
    return { title: baseTitle, contentHtml: sanitizeImportedHtml(buffer.toString('utf8')) };
  }
  if (ext === 'md' || ext === 'markdown') {
    return { title: baseTitle, contentHtml: markdownToHtml(buffer.toString('utf8')) };
  }
  // Plain text (.txt, .fountain, .csv, etc.)
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`);
  return {
    title: baseTitle,
    contentHtml: paragraphs.length > 0 ? paragraphs.join('\n') : '<p><br></p>',
  };
}

// =============================================================================
// Export Engine (HTML -> Markdown / Text / RTF / HTML / DOC / DOCX / ODT)
// =============================================================================

interface ParsedBlock {
  tag: 'h1' | 'h2' | 'h3' | 'blockquote' | 'p' | 'li';
  runs: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean }>;
}

function parseInlineRuns(
  htmlFragment: string,
  state = { bold: false, italic: false, underline: false },
): Array<{ text: string; bold: boolean; italic: boolean; underline: boolean }> {
  const runs: Array<{ text: string; bold: boolean; italic: boolean; underline: boolean }> = [];
  const tokenRegex = /(<\/?(?:strong|b|em|i|u|br)\b[^>]*>)/gi;
  const parts = htmlFragment.split(tokenRegex);
  const stack = [{ ...state }];

  for (const part of parts) {
    if (!part) continue;
    const lower = part.toLowerCase();
    if (lower.startsWith('<br')) {
      runs.push({ text: '\n', ...stack[stack.length - 1] });
    } else if (lower.startsWith('<strong') || lower.startsWith('<b')) {
      stack.push({ ...stack[stack.length - 1], bold: true });
    } else if (lower.startsWith('</strong') || lower.startsWith('</b')) {
      if (stack.length > 1) stack.pop();
    } else if (lower.startsWith('<em') || lower.startsWith('<i')) {
      stack.push({ ...stack[stack.length - 1], italic: true });
    } else if (lower.startsWith('</em') || lower.startsWith('</i')) {
      if (stack.length > 1) stack.pop();
    } else if (lower.startsWith('<u')) {
      stack.push({ ...stack[stack.length - 1], underline: true });
    } else if (lower.startsWith('</u')) {
      if (stack.length > 1) stack.pop();
    } else {
      const text = decodeXmlEntities(part.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '));
      if (text) {
        runs.push({ text, ...stack[stack.length - 1] });
      }
    }
  }
  return runs;
}

function htmlToBlocks(html: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const blockRegex = /<(h1|h2|h3|h4|blockquote|li|p|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = blockRegex.exec(html)) !== null) {
    lastEnd = blockRegex.lastIndex;
    const rawTag = match[1].toLowerCase();
    const tag: ParsedBlock['tag'] =
      rawTag === 'h1'
        ? 'h1'
        : rawTag === 'h2'
          ? 'h2'
          : rawTag === 'h3' || rawTag === 'h4'
            ? 'h3'
            : rawTag === 'blockquote'
              ? 'blockquote'
              : rawTag === 'li'
                ? 'li'
                : 'p';
    const runs = parseInlineRuns(match[2]);
    if (runs.some((r) => r.text.trim())) {
      blocks.push({ tag, runs });
    }
  }

  if (blocks.length === 0 && lastEnd === 0) {
    const plain = stripHtmlToText(html);
    for (const para of plain.split(/\n+/)) {
      if (para.trim()) {
        blocks.push({
          tag: 'p',
          runs: [{ text: para.trim(), bold: false, italic: false, underline: false }],
        });
      }
    }
  }
  return blocks;
}

function collectChaptersHtml(work: WorkItem, chapterId?: string): ChapterItem[] {
  if (chapterId) {
    const found = work.chapters.find((c) => c.id === chapterId);
    if (found) return [found];
  }
  return work.chapters;
}

function getCombinedBlocks(work: WorkItem, chapterId?: string): ParsedBlock[] {
  const chapters = collectChaptersHtml(work, chapterId);
  const blocks: ParsedBlock[] = [
    { tag: 'h1', runs: [{ text: work.title, bold: true, italic: false, underline: false }] },
  ];
  if (work.subtitle.trim()) {
    blocks.push({
      tag: 'p',
      runs: [{ text: work.subtitle, bold: false, italic: true, underline: false }],
    });
  }
  if (work.author.trim()) {
    blocks.push({
      tag: 'p',
      runs: [{ text: `By ${work.author}`, bold: false, italic: false, underline: false }],
    });
  }

  for (const chapter of chapters) {
    if (work.kind === 'book') {
      blocks.push({
        tag: 'h2',
        runs: [{ text: chapter.title, bold: true, italic: false, underline: false }],
      });
    }
    blocks.push(...htmlToBlocks(chapter.contentHtml));
    for (const scene of chapter.scenes) {
      if (scene.title.trim()) {
        blocks.push({
          tag: 'h3',
          runs: [{ text: scene.title, bold: true, italic: false, underline: false }],
        });
      }
      blocks.push(...htmlToBlocks(scene.contentHtml));
    }
  }
  return blocks;
}

function blocksToMarkdown(blocks: ParsedBlock[]): string {
  return blocks
    .map((block) => {
      const line = block.runs
        .map((r) => {
          let t = r.text;
          if (!t.trim()) return t;
          if (r.bold && r.italic) t = `***${t}***`;
          else if (r.bold) t = `**${t}**`;
          else if (r.italic) t = `*${t}*`;
          return t;
        })
        .join('');
      if (block.tag === 'h1') return `# ${line}`;
      if (block.tag === 'h2') return `## ${line}`;
      if (block.tag === 'h3') return `### ${line}`;
      if (block.tag === 'blockquote') return `> ${line}`;
      if (block.tag === 'li') return `- ${line}`;
      return line;
    })
    .join('\n\n');
}

function blocksToRtf(blocks: ParsedBlock[], lineHeight = 1.75): string {
  const slVal = Math.round(lineHeight * 240);
  const escRtf = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/[^\x00-\x7F]/g, (ch) => `\\u${ch.charCodeAt(0)}?`)
      .replace(/\n/g, '\\line ');

  const body = blocks
    .map((b) => {
      const size = b.tag === 'h1' ? 36 : b.tag === 'h2' ? 28 : b.tag === 'h3' ? 24 : 22;
      const prefix = b.tag === 'li' ? '\\bullet  ' : b.tag === 'blockquote' ? '\\li720 ' : '';
      const runs = b.runs
        .map((r) => {
          const open = `${r.bold || b.tag.startsWith('h') ? '\\b ' : ''}${r.italic || b.tag === 'blockquote' ? '\\i ' : ''}${r.underline ? '\\ul ' : ''}`;
          const close = `${r.underline ? '\\ul0 ' : ''}${r.italic || b.tag === 'blockquote' ? '\\i0 ' : ''}${r.bold || b.tag.startsWith('h') ? '\\b0 ' : ''}`;
          return `${open}${escRtf(r.text)}${close}`;
        })
        .join('');
      return `\\pard\\sa180\\sl${slVal}\\slmult1${prefix}\\fs${size} ${runs}\\par`;
    })
    .join('\n');

  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\froman Georgia;}}\\f0\\fs22\n${body}\n}`;
}

export interface ExportPaperSpec {
  widthMm: number;
  heightMm: number;
}

function isWorkRtl(work: WorkItem): boolean {
  if (work.direction === 'rtl') return true;
  if (work.direction === 'ltr') return false;
  const sample = `${work.title} ${work.chapters[0]?.contentHtml ?? ''}`;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(sample);
}

async function blocksToDocx(
  blocks: ParsedBlock[],
  title: string,
  paperSpec: ExportPaperSpec = { widthMm: 210, heightMm: 297 },
  isRtl = false,
  lineHeight = 1.75,
  letterSpacingEm = 0,
): Promise<Buffer> {
  const twipsW = Math.round((paperSpec.widthMm / 25.4) * 1440);
  const twipsH = Math.round((paperSpec.heightMm / 25.4) * 1440);
  const wLine = Math.round(lineHeight * 240);
  const spacingTwips = Math.round(letterSpacingEm * 220);
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/>${spacingTwips !== 0 ? `<w:spacing w:val="${spacingTwips}"/>` : ''}</w:rPr>
    <w:pPr><w:spacing w:after="160" w:line="${wLine}" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="280" w:after="140"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="40"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:pPr><w:ind w:left="720"/><w:spacing w:before="140" w:after="140"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:sz w:val="24"/></w:rPr>
  </w:style>
</w:styles>`,
  );

  const paragraphsXml = blocks
    .map((block) => {
      const styleId =
        block.tag === 'h1'
          ? 'Heading1'
          : block.tag === 'h2'
            ? 'Heading2'
            : block.tag === 'h3'
              ? 'Heading3'
              : block.tag === 'blockquote'
                ? 'Quote'
                : 'Normal';
      const runsXml = block.runs
        .map((r, idx) => {
          const prefix = block.tag === 'li' && idx === 0 ? '• ' : '';
          const rPr = [
            r.bold ? '<w:b/>' : '',
            r.italic ? '<w:i/>' : '',
            r.underline ? '<w:u w:val="single"/>' : '',
            isRtl ? '<w:rtl/>' : '',
          ].join('');
          const lines = (prefix + r.text).split('\n');
          const textXml = lines
            .map((line, lineIdx) => `${lineIdx > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`)
            .join('');
          return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${textXml}</w:r>`;
        })
        .join('');
      return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/>${isRtl ? '<w:bidi/>' : ''}</w:pPr>${runsXml}</w:p>`;
    })
    .join('\n');

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" dc:title="${escapeXml(title)}" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <w:body>
    ${paragraphsXml}
    <w:sectPr>${isRtl ? '<w:bidi/>' : ''}<w:pgSz w:w="${twipsW}" w:h="${twipsH}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function blocksToOdt(
  blocks: ParsedBlock[],
  paperSpec: ExportPaperSpec = { widthMm: 210, heightMm: 297 },
  isRtl = false,
  lineHeight = 1.75,
  letterSpacingEm = 0,
): Promise<Buffer> {
  const odtLinePct = `${Math.round(lineHeight * 100)}%`;
  const odtLetter = letterSpacingEm !== 0 ? ` fo:letter-spacing="${letterSpacingEm}em"` : '';
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });

  zip.file(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`,
  );

  zip.file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:line-height="${odtLinePct}" fo:margin-bottom="0.28cm"${isRtl ? ' fo:text-align="right" style:writing-mode="rl-tb"' : ''}/>
      <style:text-properties fo:font-family="${isRtl ? 'Amiri' : 'Georgia'}" fo:font-size="11.5pt"${odtLetter}/>
    </style:default-style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="WickPageLayout">
      <style:page-layout-properties fo:page-width="${paperSpec.widthMm}mm" fo:page-height="${paperSpec.heightMm}mm" fo:margin-top="20mm" fo:margin-bottom="20mm" fo:margin-left="20mm" fo:margin-right="20mm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="WickPageLayout"/>
  </office:master-styles>
</office:document-styles>`,
  );

  const bodyXml = blocks
    .map((block) => {
      const inner = block.runs
        .map((r, idx) => {
          const text = (block.tag === 'li' && idx === 0 ? '• ' : '') + r.text;
          const escaped = escapeXml(text).replace(/\n/g, '<text:line-break/>');
          const styleKey = `${r.bold ? 'B' : ''}${r.italic ? 'I' : ''}${r.underline ? 'U' : ''}`;
          if (!styleKey) return escaped;
          return `<text:span text:style-name="Wick${styleKey}">${escaped}</text:span>`;
        })
        .join('');
      if (block.tag === 'h1') return `<text:h text:outline-level="1" text:style-name="WickH1">${inner}</text:h>`;
      if (block.tag === 'h2') return `<text:h text:outline-level="2" text:style-name="WickH2">${inner}</text:h>`;
      if (block.tag === 'h3') return `<text:h text:outline-level="3" text:style-name="WickH3">${inner}</text:h>`;
      if (block.tag === 'blockquote') return `<text:p text:style-name="WickQuote">${inner}</text:p>`;
      return `<text:p>${inner}</text:p>`;
    })
    .join('\n');

  zip.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="WickH1" style:family="paragraph"><style:text-properties fo:font-size="20pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="WickH2" style:family="paragraph"><style:text-properties fo:font-size="16pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="WickH3" style:family="paragraph"><style:text-properties fo:font-size="13pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="WickQuote" style:family="paragraph"><style:paragraph-properties fo:margin-left="1cm"/><style:text-properties fo:font-style="italic"/></style:style>
    <style:style style:name="WickB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
    <style:style style:name="WickI" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
    <style:style style:name="WickU" style:family="text"><style:text-properties style:text-underline-style="solid"/></style:style>
    <style:style style:name="WickBI" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic"/></style:style>
    <style:style style:name="WickBU" style:family="text"><style:text-properties fo:font-weight="bold" style:text-underline-style="solid"/></style:style>
    <style:style style:name="WickIU" style:family="text"><style:text-properties fo:font-style="italic" style:text-underline-style="solid"/></style:style>
    <style:style style:name="WickBIU" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic" style:text-underline-style="solid"/></style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${bodyXml}
    </office:text>
  </office:body>
</office:document-content>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function workToStandaloneHtml(
  work: WorkItem,
  chapterId?: string,
  forWordDoc = false,
  paperSpec: ExportPaperSpec = { widthMm: 210, heightMm: 297 },
): string {
  const chapters = collectChaptersHtml(work, chapterId);
  const body = chapters
    .map((ch) => {
      const heading = work.kind === 'book' ? `<h2>${escapeHtml(ch.title)}</h2>` : '';
      const scenes = ch.scenes
        .map(
          (sc) =>
            `${sc.title.trim() ? `<h3>${escapeHtml(sc.title)}</h3>` : ''}<div class="scene">${sc.contentHtml}</div>`,
        )
        .join('\n');
      return `<section class="chapter">${heading}${ch.contentHtml}${scenes}</section>`;
    })
    .join('\n');

  const wordNs = forWordDoc
    ? `xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"`
    : '';
  const isRtl = isWorkRtl(work);
  const lineHeight = work.lineHeight ?? (isRtl ? 1.9 : 1.75);
  const letterSpacing = work.letterSpacing ?? 0;

  return `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}" ${wordNs}>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(work.title)}</title>
<style>
  @page { size: ${paperSpec.widthMm}mm ${paperSpec.heightMm}mm; margin: 20mm; }
  body { font-family: ${isRtl ? '"Amiri", Tahoma, Georgia, serif' : 'Georgia, "Times New Roman", serif'}; line-height: ${lineHeight}; letter-spacing: ${letterSpacing}em; color: #1c1917; max-width: ${Math.max(110, paperSpec.widthMm - 40)}mm; margin: 3rem auto; padding: 0 1.5rem; }
  h1 { font-size: 2.1rem; margin-bottom: 0.25rem; }
  .subtitle { font-style: italic; color: #57534e; margin-top: 0; margin-bottom: 2rem; }
  h2 { font-size: 1.45rem; margin-top: 2.5rem; margin-bottom: 1rem; page-break-before: always; }
  h2:first-of-type { page-break-before: auto; }
  blockquote { margin: 1.25rem 0; padding-inline-start: 1.25rem; font-style: italic; color: #44403c; }
  p { margin: 0 0 1.05rem 0; }
</style>
</head>
<body dir="${isRtl ? 'rtl' : 'ltr'}">
  <h1>${escapeHtml(work.title)}</h1>
  ${work.subtitle ? `<p class="subtitle">${escapeHtml(work.subtitle)}</p>` : ''}
  ${work.author ? `<p class="subtitle">By ${escapeHtml(work.author)}</p>` : ''}
  ${body}
</body>
</html>`;
}

export async function exportWork(
  work: WorkItem,
  format: ExportFormat,
  chapterId?: string,
  paperSpec: ExportPaperSpec = { widthMm: 210, heightMm: 297 },
): Promise<{ buffer: Buffer; mimeType: string; filename: string; utf8Filename: string }> {
  const safeAsciiBase =
    work.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'manuscript';

  const safeUnicodeBase =
    work.title
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '-') || safeAsciiBase;

  const blocks = getCombinedBlocks(work, chapterId);
  const isRtl = isWorkRtl(work);
  const resolvedLineHeight = work.lineHeight ?? (isRtl ? 1.9 : 1.75);
  const resolvedLetterSpacing = work.letterSpacing ?? 0;

  switch (format) {
    case 'docx': {
      const buffer = await blocksToDocx(
        blocks,
        work.title,
        paperSpec,
        isRtl,
        resolvedLineHeight,
        resolvedLetterSpacing,
      );
      return {
        buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `${safeAsciiBase}.docx`,
        utf8Filename: `${safeUnicodeBase}.docx`,
      };
    }
    case 'doc': {
      const html = workToStandaloneHtml(work, chapterId, true, paperSpec);
      return {
        buffer: Buffer.from('\ufeff' + html, 'utf8'),
        mimeType: 'application/msword',
        filename: `${safeAsciiBase}.doc`,
        utf8Filename: `${safeUnicodeBase}.doc`,
      };
    }
    case 'odt': {
      const buffer = await blocksToOdt(
        blocks,
        paperSpec,
        isRtl,
        resolvedLineHeight,
        resolvedLetterSpacing,
      );
      return {
        buffer,
        mimeType: 'application/vnd.oasis.opendocument.text',
        filename: `${safeAsciiBase}.odt`,
        utf8Filename: `${safeUnicodeBase}.odt`,
      };
    }
    case 'rtf': {
      const rtf = blocksToRtf(blocks, resolvedLineHeight);
      return {
        buffer: Buffer.from(rtf, 'utf8'),
        mimeType: 'application/rtf',
        filename: `${safeAsciiBase}.rtf`,
        utf8Filename: `${safeUnicodeBase}.rtf`,
      };
    }
    case 'md': {
      const md = blocksToMarkdown(blocks);
      return {
        buffer: Buffer.from(md, 'utf8'),
        mimeType: 'text/markdown; charset=utf-8',
        filename: `${safeAsciiBase}.md`,
        utf8Filename: `${safeUnicodeBase}.md`,
      };
    }
    case 'txt': {
      const text = blocks
        .map((b) => b.runs.map((r) => r.text).join(''))
        .join('\n\n');
      return {
        buffer: Buffer.from(text, 'utf8'),
        mimeType: 'text/plain; charset=utf-8',
        filename: `${safeAsciiBase}.txt`,
        utf8Filename: `${safeUnicodeBase}.txt`,
      };
    }
    case 'html':
    case 'pdf':
    default: {
      const html = workToStandaloneHtml(work, chapterId, false, paperSpec);
      return {
        buffer: Buffer.from(html, 'utf8'),
        mimeType: 'text/html; charset=utf-8',
        filename: `${safeAsciiBase}.html`,
        utf8Filename: `${safeUnicodeBase}.html`,
      };
    }
  }
}
