export interface EditorSelectionSpacingState {
  range: Range;
  hasTextSelection: boolean;
  blockLineHeight?: number;
  selectionLetterSpacing?: number;
}

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, blockquote, li';

function ensureRootBlocks(editorEl: HTMLElement): void {
  const doc = editorEl.ownerDocument;
  const children = Array.from(editorEl.childNodes);
  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length > 0) {
      const p = doc.createElement('p');
      node.parentNode?.insertBefore(p, node);
      p.appendChild(node);
    }
  }
  if (editorEl.children.length === 0) {
    const p = doc.createElement('p');
    p.innerHTML = editorEl.innerHTML.trim() || '<br>';
    editorEl.innerHTML = '';
    editorEl.appendChild(p);
  }
}

function getClosestBlock(node: Node | null, editorEl: HTMLElement): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== editorEl) {
    if (cur instanceof HTMLElement) {
      const tag = cur.tagName.toLowerCase();
      if (['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'li'].includes(tag)) {
        return cur;
      }
      if (tag === 'div' && !cur.querySelector(BLOCK_SELECTOR)) {
        return cur;
      }
    }
    cur = cur.parentNode;
  }
  return null;
}

function getIntersectingBlocks(editorEl: HTMLElement, range: Range): HTMLElement[] {
  ensureRootBlocks(editorEl);
  const candidates = Array.from(editorEl.querySelectorAll<HTMLElement>(BLOCK_SELECTOR));
  const leafDivs = Array.from(editorEl.querySelectorAll<HTMLElement>('div')).filter(
    (d) => !d.querySelector(BLOCK_SELECTOR),
  );
  const allBlocks = [...candidates, ...leafDivs];

  const matched = allBlocks.filter((block) => {
    try {
      return range.intersectsNode(block);
    } catch {
      return false;
    }
  });

  if (matched.length > 0) return matched;

  const fallback = getClosestBlock(range.startContainer, editorEl);
  return fallback ? [fallback] : [];
}

function parseEmOrNumber(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getEditorSelectionState(
  editorEl: HTMLElement | null,
): EditorSelectionSpacingState | null {
  if (!editorEl) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editorEl.contains(range.commonAncestorContainer)) return null;

  const hasTextSelection = !range.collapsed && range.toString().trim().length > 0;
  const block = getClosestBlock(range.startContainer, editorEl);
  const blockLineHeight = block ? parseEmOrNumber(block.style.lineHeight) : undefined;

  let selectionLetterSpacing: number | undefined;
  const startEl =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
  const lsSpan = startEl?.closest<HTMLElement>('span[data-wick-ls]');
  if (lsSpan && editorEl.contains(lsSpan)) {
    selectionLetterSpacing = parseEmOrNumber(lsSpan.style.letterSpacing);
  } else if (block) {
    selectionLetterSpacing = parseEmOrNumber(block.style.letterSpacing);
  }

  return {
    range: range.cloneRange(),
    hasTextSelection,
    blockLineHeight,
    selectionLetterSpacing,
  };
}

export function restoreEditorRange(editorEl: HTMLElement | null, range: Range | null): void {
  if (!editorEl || !range) return;
  if (!editorEl.contains(range.startContainer) || !editorEl.contains(range.endContainer)) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

export function applyLineHeightToSelection(
  editorEl: HTMLElement,
  savedRange: Range | null,
  lineHeight: number,
): Range | null {
  const activeSel = window.getSelection();
  const range =
    savedRange && editorEl.contains(savedRange.startContainer)
      ? savedRange
      : activeSel && activeSel.rangeCount > 0 && editorEl.contains(activeSel.anchorNode)
        ? activeSel.getRangeAt(0).cloneRange()
        : null;

  if (!range) return null;

  const blocks = getIntersectingBlocks(editorEl, range);
  for (const block of blocks) {
    block.style.lineHeight = String(lineHeight);
    block.style.setProperty('--wick-prose-line-height', String(lineHeight));
    block.querySelectorAll<HTMLElement>('[style]').forEach((child) => {
      if (child.style.lineHeight) child.style.removeProperty('line-height');
    });
  }

  restoreEditorRange(editorEl, range);
  return range.cloneRange();
}

export function applyLetterSpacingToSelection(
  editorEl: HTMLElement,
  savedRange: Range | null,
  letterSpacingEm: number,
): Range | null {
  const activeSel = window.getSelection();
  const range =
    savedRange && editorEl.contains(savedRange.startContainer)
      ? savedRange
      : activeSel && activeSel.rangeCount > 0 && editorEl.contains(activeSel.anchorNode)
        ? activeSel.getRangeAt(0).cloneRange()
        : null;

  if (!range) return null;

  if (range.collapsed) {
    const blocks = getIntersectingBlocks(editorEl, range);
    for (const block of blocks) {
      block.style.letterSpacing = `${letterSpacingEm}em`;
    }
    restoreEditorRange(editorEl, range);
    return range.cloneRange();
  }

  // Collect text nodes intersecting the range so multi-paragraph highlights work cleanly without splitting tags awkwardly
  const textNodes: Text[] = [];
  const walker = editorEl.ownerDocument.createTreeWalker(
    editorEl,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent || node.textContent.length === 0) return NodeFilter.FILTER_REJECT;
        try {
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        } catch {
          return NodeFilter.FILTER_REJECT;
        }
      },
    },
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  if (textNodes.length === 0) return range.cloneRange();

  const createdSpans: HTMLElement[] = [];

  textNodes.forEach((rawTextNode, idx) => {
    let targetNode = rawTextNode;
    const isFirst = idx === 0;
    const isLast = idx === textNodes.length - 1;

    if (isLast && targetNode === range.endContainer && range.endOffset < targetNode.length) {
      targetNode.splitText(range.endOffset);
    }
    if (isFirst && targetNode === range.startContainer && range.startOffset > 0) {
      targetNode = targetNode.splitText(range.startOffset);
    }

    if (!targetNode.textContent) return;

    const parent = targetNode.parentElement;
    if (
      parent &&
      parent.tagName.toLowerCase() === 'span' &&
      parent.hasAttribute('data-wick-ls') &&
      parent.childNodes.length === 1
    ) {
      parent.style.letterSpacing = `${letterSpacingEm}em`;
      createdSpans.push(parent);
      return;
    }

    const span = editorEl.ownerDocument.createElement('span');
    span.setAttribute('data-wick-ls', '1');
    span.style.letterSpacing = `${letterSpacingEm}em`;
    targetNode.parentNode?.insertBefore(span, targetNode);
    span.appendChild(targetNode);
    createdSpans.push(span);
  });

  if (createdSpans.length > 0) {
    const nextRange = editorEl.ownerDocument.createRange();
    nextRange.setStartBefore(createdSpans[0]);
    nextRange.setEndAfter(createdSpans[createdSpans.length - 1]);
    restoreEditorRange(editorEl, nextRange);
    return nextRange.cloneRange();
  }

  return range.cloneRange();
}

export function clearSpacingFromElement(
  container: HTMLElement,
  mode: 'lineHeight' | 'letterSpacing' | 'both',
): void {
  if (mode === 'lineHeight' || mode === 'both') {
    container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      el.style.removeProperty('line-height');
      el.style.removeProperty('--wick-prose-line-height');
      if (el.getAttribute('style')?.trim() === '') el.removeAttribute('style');
    });
  }
  if (mode === 'letterSpacing' || mode === 'both') {
    container.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      el.style.removeProperty('letter-spacing');
      if (el.getAttribute('style')?.trim() === '') el.removeAttribute('style');
    });
    container.querySelectorAll<HTMLElement>('span[data-wick-ls]').forEach((span) => {
      if (!span.getAttribute('style')) {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        span.remove();
      }
    });
  }
}

export function clearSpacingFromHtml(
  rawHtml: string,
  mode: 'lineHeight' | 'letterSpacing' | 'both',
): string {
  const div = document.createElement('div');
  div.innerHTML = rawHtml || '<p><br></p>';
  clearSpacingFromElement(div, mode);
  return div.innerHTML || '<p><br></p>';
}
