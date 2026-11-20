import { useMemo } from 'react';
import { BookOpen, Compass, PenLine } from 'lucide-react';
import { useWick } from '../../context/WickContext';
import { getWorkTotalWords } from '../../utils/htmlUtils';
import { WickButton, WickDivider } from '../ui/WickPrimitives';

export function JourneyWorkspace() {
  const { journeySessions, works, openWorkTab, createWork } = useWick();

  const stats = useMemo(() => {
    const totalSessionWords = journeySessions.reduce((s, item) => s + item.wordsAdded, 0);
    const totalLibraryWords = works.reduce((s, w) => s + getWorkTotalWords(w.chapters), 0);
    const uniqueDays = new Set(journeySessions.map((s) => s.date)).size;
    const totalMinutes = journeySessions.reduce((s, item) => s + item.minutes, 0);
    return {
      totalWords: Math.max(totalSessionWords, totalLibraryWords),
      uniqueDays,
      totalMinutes,
    };
  }, [journeySessions, works]);

  // 12 weeks (84 days) calm rhythm mosaic
  const calendarDays = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const session of journeySessions) {
      byDate.set(session.date, (byDate.get(session.date) ?? 0) + session.wordsAdded);
    }
    const days: Array<{ date: string; words: number; label: string }> = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const words = byDate.get(iso) ?? 0;
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      days.push({ date: iso, words, label });
    }
    return days;
  }, [journeySessions]);

  const maxWorkWords = useMemo(() => {
    return Math.max(1, ...works.map((w) => getWorkTotalWords(w.chapters)));
  }, [works]);

  const recentSessions = useMemo(() => {
    return [...journeySessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [journeySessions]);

  return (
    <div className="h-full overflow-y-auto px-6 py-10 md:px-12 lg:px-16">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs text-[var(--wick-amber)] mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Your Journey</span>
          </div>
          <h1 className="wick-font-display text-3xl md:text-4xl font-semibold tracking-tight text-[var(--wick-ink)] text-balance">
            Quiet Momentum
          </h1>
          <p className="text-sm text-[var(--wick-muted)] mt-2 max-w-xl leading-relaxed">
            A calm reflection of the pages you have shaped so far. Return whenever you have a
            thought worth keeping—no quotas, no pressure.
          </p>
        </header>

        {/* Clean Unboxed Key Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-6 border-y border-[var(--wick-border)]">
          <div>
            <div className="text-xs text-[var(--wick-muted)] mb-1">Words in Sanctuary</div>
            <div className="wick-tabular text-3xl font-medium text-[var(--wick-ink)]">
              {stats.totalWords.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--wick-muted)] mb-1">Days Spent Writing</div>
            <div className="wick-tabular text-3xl font-medium text-[var(--wick-amber)]">
              {stats.uniqueDays}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--wick-muted)] mb-1">Estimated Focus Time</div>
            <div className="wick-tabular text-3xl font-medium text-[var(--wick-ink)]">
              {Math.max(1, Math.round(stats.totalMinutes / 60))}h {stats.totalMinutes % 60}m
            </div>
          </div>
        </div>

        {/* 12-Week Writing Rhythm */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Last Twelve Weeks
            </h2>
            <span className="text-xs text-[var(--wick-muted)]">
              Each square marks a day you visited the page
            </span>
          </div>

          <div className="p-5 rounded-xl border border-[var(--wick-border)] bg-[var(--wick-surface)]">
            <div className="grid grid-cols-12 sm:grid-cols-14 md:grid-cols-[repeat(21,minmax(0,1fr))] gap-1.5">
              {calendarDays.map((day) => {
                let bg = 'var(--color-background-muted)';
                if (day.words > 0 && day.words < 250) bg = 'rgba(224, 159, 62, 0.28)';
                else if (day.words >= 250 && day.words < 600) bg = 'rgba(224, 159, 62, 0.56)';
                else if (day.words >= 600) bg = 'var(--wick-amber)';

                return (
                  <div
                    key={day.date}
                    title={`${day.label}: ${day.words.toLocaleString()} words`}
                    className="aspect-square rounded-[4px] transition-transform duration-150 hover:scale-110"
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Works Breakdown */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)]">
              Across Your Manuscripts
            </h2>
            <WickButton
              label="Start Blank Page"
              variant="ghost"
              size="sm"
              icon={<PenLine className="w-3.5 h-3.5" />}
              onClick={() => void createWork('document')}
            />
          </div>

          <div className="space-y-4">
            {works.map((w) => {
              const words = getWorkTotalWords(w.chapters);
              const pct = Math.max(4, Math.round((words / maxWorkWords) * 100));
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => openWorkTab(w.id)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-[var(--wick-ink)] group-hover:text-[var(--wick-amber)] transition-colors flex items-center gap-2 truncate">
                      <BookOpen className="w-3.5 h-3.5 text-[var(--wick-muted)] shrink-0" />
                      <span className="truncate">{w.title}</span>
                    </span>
                    <span className="wick-tabular text-xs text-[var(--wick-muted)] shrink-0">
                      {words.toLocaleString()} words
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--color-background-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          w.kind === 'book' ? 'var(--wick-amber)' : 'var(--wick-violet)',
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="my-10">
          <WickDivider />
        </div>

        {/* Recent Writing Notes */}
        <section className="pb-10">
          <h2 className="wick-font-display text-lg font-medium text-[var(--wick-ink)] mb-4">
            Recent Writing Sessions
          </h2>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-[var(--wick-muted)]">
              Open any document and begin writing to record your first quiet session.
            </p>
          ) : (
            <div className="divide-y divide-[var(--wick-border)]">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-[var(--wick-ink)] font-medium truncate block">
                      {session.workTitle}
                    </span>
                    <span className="text-xs text-[var(--wick-muted)]">{session.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--wick-muted)] wick-tabular shrink-0">
                    <span className="text-[var(--wick-amber)]">
                      +{session.wordsAdded.toLocaleString()} words
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{session.minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
