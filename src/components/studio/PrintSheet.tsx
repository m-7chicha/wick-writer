import { useWick } from '../../context/WickContext';
import { getEditorFontStack, resolvePaperDimensions } from '../../theme/wickTheme';

export function PrintSheet() {
  const { printTarget } = useWick();
  if (!printTarget) return null;

  const { work, chapterId, paperSize, customPaperWidthMm, customPaperHeightMm } = printTarget;
  const paper = resolvePaperDimensions(paperSize, customPaperWidthMm, customPaperHeightMm);
  const chapters = chapterId
    ? work.chapters.filter((ch) => ch.id === chapterId)
    : work.chapters;

  const dir =
    work.direction === 'rtl'
      ? 'rtl'
      : work.direction === 'ltr'
        ? 'ltr'
        : /[\u0600-\u06FF]/.test(`${work.title} ${chapters[0]?.contentHtml ?? ''}`)
          ? 'rtl'
          : 'ltr';

  const lineHeight = work.lineHeight ?? (dir === 'rtl' ? 1.9 : 1.75);
  const letterSpacing = `${work.letterSpacing ?? 0}em`;

  return (
    <div
      dir={dir}
      className="hidden print:block wick-print-sheet"
      style={{
        fontFamily: getEditorFontStack(work.defaultFont),
        lineHeight,
        letterSpacing,
      }}
    >
      <style>{`@page { size: ${paper.cssPageSize}; margin: 20mm; }`}</style>

      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold mb-2">{work.title}</h1>
        {work.subtitle && <p className="text-base italic text-neutral-600">{work.subtitle}</p>}
        {work.author && <p className="text-sm text-neutral-500 mt-3">{work.author}</p>}
      </div>

      {chapters.map((chapter) => (
        <section key={chapter.id} className="wick-print-chapter mb-10">
          {work.kind === 'book' && (
            <h2 className="text-xl font-semibold mb-6 border-b border-neutral-200 pb-2">
              {chapter.title}
            </h2>
          )}
          <div
            dir={dir}
            className="wick-prose text-[11.5pt]"
            style={{
              lineHeight,
              letterSpacing,
              ['--wick-prose-line-height' as string]: String(lineHeight),
              ['--wick-prose-letter-spacing' as string]: letterSpacing,
            }}
            dangerouslySetInnerHTML={{ __html: chapter.contentHtml }}
          />
          {chapter.scenes.map((scene) => (
            <div key={scene.id} className="mt-8">
              {scene.title && <h3 className="text-base font-medium mb-3">{scene.title}</h3>}
              <div
                dir={dir}
                className="wick-prose text-[11.5pt]"
                style={{
                  lineHeight,
                  letterSpacing,
                  ['--wick-prose-line-height' as string]: String(lineHeight),
                  ['--wick-prose-letter-spacing' as string]: letterSpacing,
                }}
                dangerouslySetInnerHTML={{ __html: scene.contentHtml }}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
