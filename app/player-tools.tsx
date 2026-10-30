'use client';
/* oxlint-disable react/react-compiler -- Browser preferences are restored after hydration. */
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Settings,
  X,
  Download,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { allAnswers as answers, allValid as valid } from '@/lib/word-pools.mjs';
import {
  THEME_KEY,
  LANGUAGE_KEY,
  themes,
  gameKey,
  readGames,
  dailyStats,
  parseBackup,
  mergeGames,
} from '@/lib/profile.mjs';
import {
  localDay,
  outcome,
  HINTS_KEY,
  HARD_KEY,
  ABSURD_BEST_KEY,
  PRACTICE_LENGTH_KEY,
} from '@/lib/game.mjs';
import { useLanguage } from './language';
import { SHIRITORI_BEST_KEY } from '@/lib/shiritori.mjs';
import {
  ABSURD_PLAYED_KEY,
  SHIRITORI_PLAYED_KEY,
  beeStats,
  ladderStats,
  multiStats,
  wadouStats,
} from '@/lib/stats.mjs';
import { GAME_ORDER, gameLabel, type GameName } from './game-menu';
import type { Game } from '@/lib/types';

// A switch for a per-round mode. A round keeps the mode it had at its first
// guess, so a change mid-round applies from the next one.
function ModeSetting({
  field,
  title,
  description,
  checked,
  onChange,
  game,
}: {
  field: 'hints' | 'hard';
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  game: Game | null;
}) {
  const { t } = useLanguage();
  const pending =
    !!game &&
    game.guesses.length > 0 &&
    outcome(game) === 'playing' &&
    !!game[field] !== checked;
  return (
    <section className="settings-section">
      <h3 id={field + '-heading'}>{t(title)}</h3>
      <label className="switch-row">
        <span>{t(description)}</span>
        <Switch
          checked={checked}
          onCheckedChange={(value) => onChange(value)}
          aria-labelledby={field + '-heading'}
        />
      </label>
      {pending && (
        <p className="panel-note">
          {t('回答を始めた問題はそのまま。次の問題から切り替わります。')}
        </p>
      )}
    </section>
  );
}
type Backup = {
  app: string;
  version: number;
  theme: string;
  language?: string;
  practiceLength?: number;
  hints?: boolean;
  hard?: boolean;
  games: Game[];
};

export function PlayerTools({
  kind,
  game,
  day,
  busy,
  practiceLength,
  hints,
  onHintsChange,
  hard,
  onHardChange,
  onImport,
}: {
  // The game on screen; statistics open on it.
  kind: GameName;
  game: Game | null;
  day: string;
  busy: boolean;
  practiceLength: number;
  hints: boolean;
  onHintsChange: (value: boolean) => void;
  hard: boolean;
  onHardChange: (value: boolean) => void;
  onImport: () => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [panel, setPanel] = useState<'stats' | 'settings' | null>(null);
  const [view, setView] = useState<GameName>('kotoba');
  const [theme, setTheme] = useState('system');
  const [ready, setReady] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Backup | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && themes.includes(saved)) setTheme(saved);
    } catch {
      /* System theme is safe when storage is blocked. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, ready]);

  useEffect(() => {
    try {
      const saved = readGames(localStorage, answers, valid) as Game[];
      setGames(game ? [...saved.filter((g) => g.id !== game.id), game] : saved);
    } catch {
      setGames(game ? [game] : []);
    }
  }, [game, panel]);

  function chooseTheme(value: unknown) {
    const next = String(value);
    if (!themes.includes(next)) return;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      setNotice('表示は変更しましたが、このブラウザには設定を保存できません。');
    }
  }
  function exportBackup() {
    try {
      const data = {
        app: 'kotoba',
        version: 1,
        exportedAt: new Date().toISOString(),
        theme,
        language,
        practiceLength,
        hints,
        hard,
        games,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kotoba-backup-' + localDay() + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('バックアップをダウンロードしました。');
    } catch {
      setNotice('ダウンロードできませんでした。もう一度お試しください。');
    }
  }
  async function selectFile(selected?: File) {
    setPending(null);
    if (!selected) return;
    try {
      if (selected.size > 5_000_000) throw new Error('too large');
      const backup = parseBackup(
        await selected.text(),
        answers,
        valid,
      ) as Backup;
      setPending(backup);
      setNotice('');
    } catch {
      setNotice(
        'このファイルは読み込めません。有効なことばのバックアップ（5 MB以内）を選んでください。',
      );
    }
  }
  function importBackup() {
    if (!pending || busy) return;
    const previous: [string, string | null][] = [];
    try {
      const saved = readGames(localStorage, answers, valid) as Game[];
      const existing = game
        ? [...saved.filter((g) => g.id !== game.id), game]
        : saved;
      const merged = mergeGames(existing, pending.games) as Game[];
      const writes: [string, string][] = merged.map((g) => [
        gameKey(g.id),
        JSON.stringify(g),
      ]);
      writes.push([THEME_KEY, pending.theme]);
      if (pending.language) writes.push([LANGUAGE_KEY, pending.language]);
      if (pending.practiceLength)
        writes.push([PRACTICE_LENGTH_KEY, String(pending.practiceLength)]);
      if (pending.hints !== undefined)
        writes.push([HINTS_KEY, pending.hints ? '1' : '0']);
      if (pending.hard !== undefined)
        writes.push([HARD_KEY, pending.hard ? '1' : '0']);
      for (const [key, value] of writes) {
        const old = localStorage.getItem(key);
        if (old === value) continue;
        previous.push([key, old]);
        localStorage.setItem(key, value);
      }
      setGames(merged);
      setTheme(pending.theme);
      if (pending.language) setLanguage(pending.language);
      setPending(null);
      onImport();
      setNotice('記録と設定を読み込みました。');
    } catch {
      let rollbackFailed = false;
      for (const [key, value] of previous.reverse()) {
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          rollbackFailed = true;
        }
      }
      setNotice(
        rollbackFailed
          ? '保存できませんでした。一部の記録が変わった可能性があります。バックアップを保管してください。'
          : '保存できませんでした。元の記録は変更していません。空き容量やブラウザの設定を確認してください。',
      );
    }
  }
  // The chosen game's numbers, read from storage while the panel is open.
  const today = day || localDay();
  let cards: [string | number, string][] = [];
  let parCards: [number, string][] = [];
  let distribution: number[] = [];
  let todayRow = -1;
  let played = 0;
  const daily = !['bee', 'absurd', 'shiritori'].includes(view);
  if (panel === 'stats')
    try {
      const streak = (stats: {
        played: number;
        rate: number;
        current: number;
        best: number;
        distribution: number[];
        todayGuesses: number;
      }) => {
        played = stats.played;
        distribution = stats.distribution;
        todayRow = stats.todayGuesses - 1;
        cards = [
          [stats.played, t('プレイ数')],
          [stats.rate + '%', view === 'ladder' ? t('ゴール率') : t('正解率')],
          [stats.current, t('現在の連勝')],
          [stats.best, t('最高連勝')],
        ];
      };
      if (view === 'kotoba') streak(dailyStats(games, today));
      else if (view === 'double' || view === 'triple')
        streak(multiStats(localStorage, view === 'triple' ? 3 : 2, today));
      else if (view === 'wadou') streak(wadouStats(localStorage, today));
      else if (view === 'ladder') {
        const stats = ladderStats(localStorage, today);
        streak(stats);
        parCards = [
          [stats.par.under, t('パーより少ない')],
          [stats.par.on, t('パーぴったり')],
          [stats.par.over, t('パーより多い')],
        ];
      } else if (view === 'bee') {
        const stats = beeStats(localStorage, today);
        played = stats.played;
        cards = [
          [stats.played, t('遊んだ日')],
          [stats.best, t('最高得点')],
          [stats.words, t('見つけた言葉')],
          [stats.today, t('今日の点数')],
        ];
      } else {
        const absurd = view === 'absurd';
        const best =
          Number(
            localStorage.getItem(absurd ? ABSURD_BEST_KEY : SHIRITORI_BEST_KEY),
          ) || 0;
        played =
          Number(
            localStorage.getItem(
              absurd ? ABSURD_PLAYED_KEY : SHIRITORI_PLAYED_KEY,
            ),
          ) || 0;
        cards = [
          [
            best ? t(best + (absurd ? '手' : '語')) : '—',
            absurd ? t('最少手数') : t('最長'),
          ],
          [played, t('遊んだ回数')],
        ];
      }
    } catch {
      /* Show nothing when storage is blocked. */
    }
  const maximum = Math.max(1, ...distribution);
  const open = (value: 'stats' | 'settings') => {
    if (value === 'stats') setView(kind);
    setNotice('');
    setPending(null);
    setPanel(value);
  };

  return (
    <>
      <button
        className="icon-button"
        aria-label={t('成績')}
        title={t('成績')}
        onClick={() => open('stats')}
      >
        <BarChart3 size={21} />
      </button>
      <button
        className="icon-button"
        aria-label={t('設定')}
        title={t('設定')}
        onClick={() => open('settings')}
      >
        <Settings size={21} />
      </button>
      <Dialog
        open={panel !== null}
        onOpenChange={(value) => {
          if (!value) {
            setPanel(null);
            setPending(null);
          }
        }}
      >
        <DialogContent
          className="help-dialog player-dialog"
          showCloseButton={false}
        >
          <DialogClose
            className="icon-button dialog-close"
            aria-label={t('閉じる')}
          >
            <X size={20} />
          </DialogClose>
          <DialogTitle className="help-title">
            {panel === 'stats' ? t('成績') : t('設定')}
          </DialogTitle>
          {panel === 'stats' && (
            <DialogDescription className="help-intro">
              {t('このブラウザに保存された記録です。練習は含みません。')}
            </DialogDescription>
          )}
          {panel === 'stats' ? (
            <>
              <label className="stats-game">
                <span className="sr-only">{t('ゲーム')}</span>
                <select
                  value={view}
                  onChange={(e) => setView(e.currentTarget.value as GameName)}
                >
                  {GAME_ORDER.map((g) => (
                    <option key={g} value={g}>
                      {t(gameLabel(g))}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
              <dl className="stats-grid">
                {cards.map(([value, label]) => (
                  <div key={label}>
                    <dd>{value}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
              {parCards.length > 0 && (
                <dl className="stats-grid par-stats">
                  {parCards.map(([value, label]) => (
                    <div key={label}>
                      <dd>{value}</dd>
                      <dt>{label}</dt>
                    </div>
                  ))}
                </dl>
              )}
              {distribution.length > 0 && (
                <section
                  className="distribution"
                  aria-label={t('正解までの回答数')}
                >
                  <h3>{t('正解までの回答数')}</h3>
                  {distribution.map((count, i) => (
                    <div
                      className={
                        'distribution-row' + (i === todayRow ? ' today' : '')
                      }
                      key={i}
                      aria-label={t(`${i + 1}回で正解：${count}問`)}
                    >
                      <span>{i + 1}</span>
                      <div
                        className="stat-bar"
                        style={{ width: `${(count / maximum) * 100}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {!played && (
                <p className="panel-note">
                  {daily
                    ? t('一問を終えると、ここに成績が表示されます。')
                    : t('遊ぶと、ここに記録が表示されます。')}
                </p>
              )}
              {daily && (
                <p className="panel-note">
                  {t(
                    '日付は端末の時刻が基準です。不正解・途中終了、または一日空くと連勝が途切れます。',
                  )}
                </p>
              )}
              <button className="text-button" onClick={() => open('settings')}>
                {t('記録のバックアップ →')}
              </button>
            </>
          ) : (
            <>
              <section className="settings-section">
                <h3 id="theme-heading">{t('テーマ')}</h3>
                <RadioGroup
                  className="theme-options"
                  aria-labelledby="theme-heading"
                  value={theme}
                  onValueChange={chooseTheme}
                >
                  {(
                    [
                      ['system', t('自動')],
                      ['light', t('ライト')],
                      ['dark', t('ダーク')],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value}>
                      <RadioGroupItem value={value} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
              </section>
              <ModeSetting
                field="hints"
                title="ヒント表示"
                description="濁点・半濁点・大小だけが違うかなを、枠線で示します。"
                checked={hints}
                onChange={onHintsChange}
                game={game}
              />
              <ModeSetting
                field="hard"
                title="ハードモード"
                description="答えになりうる言葉だけ回答できます。"
                checked={hard}
                onChange={onHardChange}
                game={game}
              />
              <section className="settings-section">
                <h3>{t('記録のバックアップ')}</h3>
                <p className="panel-note">
                  {t(
                    '成績・途中のゲーム・設定をJSONファイルに保存します。別の端末やサイトへの引っ越しにも使えます。アカウント登録は不要です。',
                  )}
                </p>
                <div className="dialog-actions">
                  <button className="secondary-button" onClick={exportBackup}>
                    <Download size={17} />
                    {t('書き出す')}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => file.current?.click()}
                  >
                    <Upload size={17} />
                    {t('読み込む')}
                  </button>
                </div>
                <input
                  className="sr-only"
                  tabIndex={-1}
                  ref={file}
                  type="file"
                  accept=".json,application/json"
                  aria-label={t('バックアップファイル')}
                  onChange={(e) => {
                    void selectFile(e.currentTarget.files?.[0]);
                    e.currentTarget.value = '';
                  }}
                />
                {pending && (
                  <div className="import-confirm">
                    <p>
                      {pending.games.length}
                      {t(
                        '件のゲームと設定を読み込みます。同じ日の終了済みの記録は、この端末のものを残します。',
                      )}
                    </p>
                    <div className="dialog-actions">
                      <button
                        className="secondary-button"
                        onClick={() => setPending(null)}
                      >
                        {t('キャンセル')}
                      </button>
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={importBackup}
                      >
                        {t('記録を追加する')}
                      </button>
                    </div>
                  </div>
                )}
                <p className="panel-note">
                  {t(
                    '記録はこのブラウザだけに保存されます。ブラウザのデータを消す前に、書き出してください。',
                  )}
                </p>
              </section>
            </>
          )}
          {notice && (
            <output className="panel-notice" aria-live="polite">
              {t(notice)}
            </output>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
