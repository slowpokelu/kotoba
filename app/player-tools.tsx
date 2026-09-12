'use client';
/* oxlint-disable react/react-compiler -- Browser preferences are restored after hydration. */
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Settings, X, Download, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { allAnswers as answers, allValid as valid } from '@/lib/word-pools.mjs';
import {
  THEME_KEY,
  themes,
  gameKey,
  readGames,
  dailyStats,
  parseBackup,
  mergeGames,
} from '@/lib/profile.mjs';
import { localDay, PRACTICE_LENGTH_KEY } from '@/lib/game.mjs';
import { useLanguage } from './language';

type Game = {
  version: number;
  id: string;
  answer: string;
  guesses: string[];
  draft: string;
  gaveUp?: boolean;
};
type Backup = {
  app: string;
  version: number;
  theme: string;
  language?: string;
  practiceLength?: number;
  games: Game[];
};

export function PlayerTools({
  game,
  day,
  busy,
  practiceLength,
  onImport,
}: {
  game: Game | null;
  day: string;
  busy: boolean;
  practiceLength: number;
  onImport: () => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [panel, setPanel] = useState<'stats' | 'settings' | null>(null);
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
      if (pending.language) writes.push(['kotoba:language', pending.language]);
      if (pending.practiceLength)
        writes.push([PRACTICE_LENGTH_KEY, String(pending.practiceLength)]);
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
  const stats = dailyStats(games, day || localDay());
  const maximum = Math.max(1, ...stats.distribution);
  const open = (value: 'stats' | 'settings') => {
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
            {panel === 'stats' ? t('今日の一問 · 成績') : t('設定')}
          </DialogTitle>
          {panel === 'stats' && (
            <DialogDescription className="help-intro">
              {t(
                'このブラウザに保存された、終了した一問の記録。練習は含みません。',
              )}
            </DialogDescription>
          )}
          {panel === 'stats' ? (
            <>
              <dl className="stats-grid">
                {[
                  [stats.played, t('プレイ数')],
                  [stats.rate + '%', t('正解率')],
                  [stats.current, t('現在の連勝')],
                  [stats.best, t('最高連勝')],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dd>{value}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
              <section
                className="distribution"
                aria-label={t('正解までの回答数')}
              >
                <h3>{t('正解までの回答数')}</h3>
                {stats.distribution.map((count: number, i: number) => (
                  <div
                    className="distribution-row"
                    key={i}
                    aria-label={t(`${i + 1}回で正解：${count}問`)}
                  >
                    <span>{i + 1}</span>
                    <div className="bar-track">
                      <div
                        className="stat-bar"
                        style={{ width: `${(count / maximum) * 100}%` }}
                      />
                    </div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </section>
              {!stats.played && (
                <p className="panel-note">
                  {t('一問を終えると、ここに成績が表示されます。')}
                </p>
              )}
              <p className="panel-note">
                {t(
                  '日付は端末の時刻が基準です。不正解・途中終了、または一日空くと連勝が途切れます。',
                )}
              </p>
              <button className="text-button" onClick={() => open('settings')}>
                {t('記録のバックアップ →')}
              </button>
            </>
          ) : (
            <>
              <section className="settings-section">
                <h3 id="language-heading">{t('表示言語')}</h3>
                <RadioGroup
                  className="theme-options"
                  aria-labelledby="language-heading"
                  value={language}
                  onValueChange={(value) => {
                    const next = String(value);
                    if (next !== 'ja' && next !== 'en') return;
                    setLanguage(next);
                    try {
                      localStorage.setItem('kotoba:language', next);
                    } catch {
                      setNotice(
                        t(
                          '表示は変更しましたが、このブラウザには設定を保存できません。',
                        ),
                      );
                    }
                  }}
                >
                  <label lang="ja" htmlFor="language-ja">
                    <RadioGroupItem id="language-ja" value="ja" />
                    日本語
                  </label>
                  <label lang="en" htmlFor="language-en">
                    <RadioGroupItem id="language-en" value="en" />
                    English
                  </label>
                </RadioGroup>
              </section>
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
                      ['system', t('端末に合わせる')],
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
              <section className="settings-section">
                <h3>{t('記録のバックアップ')}</h3>
                <p className="panel-note">
                  {t(
                    '成績・途中のゲーム・テーマをJSONファイルに保存します。別の端末やサイトへの引っ越しにも使えます。アカウント登録は不要です。',
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
                        '件のゲームとテーマ設定を読み込みます。同じ日の終了済みの記録は、この端末のものを残します。',
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
