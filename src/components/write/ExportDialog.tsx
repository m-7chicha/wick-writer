import { useEffect, useState } from 'react';
import { ChevronDown, Download, FileText, Printer, Ruler } from 'lucide-react';
import { useWick } from '../../context/WickContext';
import { PAPER_SIZES, resolvePaperDimensions } from '../../theme/wickTheme';
import type { ExportFormat, PaperSizeId, WorkItem } from '../../types/wick';
import { WickButton, WickInput, WickMenu, WickModal } from '../ui/WickPrimitives';

interface ExportOption {
  format: ExportFormat;
  label: string;
  ext: string;
  description: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'pdf',
    label: 'PDF Document',
    ext: '.pdf',
    description: 'Print-ready literary layout via system Save as PDF',
  },
  {
    format: 'docx',
    label: 'Microsoft Word',
    ext: '.docx',
    description: 'Standard OpenXML document preserving headings and styles',
  },
  {
    format: 'odt',
    label: 'LibreOffice Writer',
    ext: '.odt',
    description: 'OpenDocument Text for Linux and Windows suites',
  },
  {
    format: 'doc',
    label: 'Word Compatible',
    ext: '.doc',
    description: 'Classic Word and WPS compatible rich document',
  },
  {
    format: 'rtf',
    label: 'Rich Text Format',
    ext: '.rtf',
    description: 'Universal formatted text across desktop editors',
  },
  {
    format: 'md',
    label: 'Markdown',
    ext: '.md',
    description: 'Clean plain-text markup converted from your formatting',
  },
  {
    format: 'html',
    label: 'Standalone HTML',
    ext: '.html',
    description: 'Self-contained typeset page for reading anywhere',
  },
  {
    format: 'txt',
    label: 'Plain Text',
    ext: '.txt',
    description: 'Unformatted prose with clean chapter breaks',
  },
];

interface ExportDialogProps {
  work: WorkItem | null;
  chapterId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ work, chapterId, isOpen, onClose }: ExportDialogProps) {
  const { settings, exportWorkFile } = useWick();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('docx');
  const [paperSize, setPaperSize] = useState<PaperSizeId>(settings.paperSize);
  const [customW, setCustomW] = useState(String(settings.customPaperWidthMm));
  const [customH, setCustomH] = useState(String(settings.customPaperHeightMm));
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaperSize(settings.paperSize);
      setCustomW(String(settings.customPaperWidthMm));
      setCustomH(String(settings.customPaperHeightMm));
    }
  }, [isOpen, settings.paperSize, settings.customPaperWidthMm, settings.customPaperHeightMm]);

  if (!work) return null;

  const resolvedW = Math.min(500, Math.max(80, parseFloat(customW) || 210));
  const resolvedH = Math.min(650, Math.max(100, parseFloat(customH) || 297));
  const resolvedPaper = resolvePaperDimensions(paperSize, resolvedW, resolvedH);
  const supportsPageSize = ['pdf', 'docx', 'odt', 'doc', 'html'].includes(selectedFormat);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportWorkFile(work.id, selectedFormat, chapterId, {
        paperSize,
        customPaperWidthMm: resolvedW,
        customPaperHeightMm: resolvedH,
      });
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <WickModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Export "${work.title}"`}
      width={560}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <WickButton label="Cancel" variant="ghost" onClick={onClose} />
          <WickButton
            label={selectedFormat === 'pdf' ? 'Prepare PDF' : `Download ${selectedFormat.toUpperCase()}`}
            variant="primary"
            isLoading={isExporting}
            icon={
              selectedFormat === 'pdf' ? (
                <Printer className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )
            }
            onClick={() => void handleExport()}
          />
        </div>
      }
    >
      <p className="text-sm text-[var(--wick-muted)] mb-4">
        Choose a format and paper size for sharing, printing, or opening in another desktop editor.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {EXPORT_OPTIONS.map((opt) => {
          const active = selectedFormat === opt.format;
          return (
            <button
              key={opt.format}
              type="button"
              onClick={() => setSelectedFormat(opt.format)}
              className={`text-left p-3 rounded-lg border transition-colors duration-150 ${
                active
                  ? 'border-[var(--wick-amber)] bg-[var(--wick-amber-soft)]'
                  : 'border-[var(--wick-border)] bg-[var(--wick-surface)] hover:border-[var(--wick-border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-[var(--wick-ink)] flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[var(--wick-amber)] shrink-0" />
                  {opt.label}
                </span>
                <span className="wick-tabular text-xs text-[var(--wick-muted)]">{opt.ext}</span>
              </div>
              <p className="text-xs text-[var(--wick-muted)] leading-relaxed">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Paper Size Selection */}
      {supportsPageSize && (
        <div className="mt-5 pt-4 border-t border-[var(--wick-border)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--wick-ink)]">
              <Ruler className="w-3.5 h-3.5 text-[var(--wick-amber)]" />
              <span>Paper Size</span>
            </div>

            <WickMenu
              menuWidth={260}
              placement="above"
              items={PAPER_SIZES.map((p) => ({
                id: p.id,
                label: p.label,
                description: p.description,
                selected: paperSize === p.id,
                onClick: () => setPaperSize(p.id),
              }))}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--wick-border-strong)] bg-[var(--wick-surface)] text-xs font-medium text-[var(--wick-ink)] hover:border-[var(--wick-amber)] transition-colors"
                >
                  <span>{resolvedPaper.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--wick-muted)]" />
                </button>
              }
            />
          </div>

          {paperSize === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <WickInput
                label="Width (mm)"
                size="sm"
                value={customW}
                onChange={setCustomW}
                placeholder="210"
              />
              <WickInput
                label="Height (mm)"
                size="sm"
                value={customH}
                onChange={setCustomH}
                placeholder="297"
              />
            </div>
          )}
        </div>
      )}
    </WickModal>
  );
}
