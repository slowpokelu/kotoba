'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; the list reads storage when it opens. */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { outcome } from '@/lib/game.mjs';
import { boardsKey, doubleOutcome } from '@/lib/double.mjs';
import { gameKey } from '@/lib/profile.mjs';
import { HAS_PRACTICE, routePath } from '@/lib/routes.mjs';
import { useLanguage } from './language';

export type GameName =
  | 'kotoba'
  | 'double'
  | 'triple'
  | 'absurd'
  | 'bee'
  | 'shiritori';
export type Route = { game: GameName; practice: boolean };

// Daily games first, then the ones to play any time.
const MENU: [GameName, string, string][] = [
  ['kotoba', 'ことば', '4文字の言葉を8回で'],
  ['double', 'ダブル', '2つの言葉を同時に、9回で'],
  ['triple', 'トリプル', '3つの言葉を同時に、10回で'],
  ['bee', 'かなビー', '7つのかなで言葉を作る'],
  ['absurd', 'いじわる', '逃げる答えを追い詰める'],
  ['shiritori', 'しりとり', 'コンピューターと言葉をつなぐ'],
];
export const gameLabel = (game: GameName) => MENU.find(([g]) => g === game)![1];

// Today's puzzles that are already finished, for the check marks.
function finishedToday(day: string) {
  const done = new Set<GameName>();
  try {
    const main = localStorage.getItem(gameKey('daily:' + day));
    if (main && outcome(JSON.parse(main)) !== 'playing') done.add('kotoba');
    for (const [game, boards] of [
      ['double', 2],
      ['triple', 3],
    ] as const) {
      const round = localStorage.getItem(boardsKey(boards, day));
      if (round && doubleOutcome(JSON.parse(round)) !== 'playing')
        done.add(game);
    }
  } catch {
    /* No marks without storage. */
  }
  return done;
}

// The game switcher, and today/practice for the games that have both. Both
// are links, so every game has an address to bookmark or share.
export function GameNav({
  route,
  base,
  day,
  disabled,
  onGo,
}: {
  route: Route;
  base: string;
  day: string;
  disabled: boolean;
  onGo: (next: Route) => void;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(new Set<GameName>());
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  // Plain clicks stay in the app; modified clicks open a new tab as usual.
  const follow = (next: Route) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    setOpen(false);
    if (!disabled) onGo(next);
  };
  return (
    <nav className="game-nav" aria-label={t('ゲーム')}>
      <div className="game-menu" ref={menu}>
        <button
          ref={trigger}
          className="game-switch"
          aria-expanded={open}
          aria-controls="game-list"
          aria-label={
            t('ゲームを選ぶ') +
            (language === 'en' ? ': ' : '：') +
            t(gameLabel(route.game))
          }
          onClick={() => {
            if (!open) setDone(finishedToday(day));
            setOpen(!open);
          }}
        >
          {t(gameLabel(route.game))}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <ul id="game-list" className="game-list">
            {MENU.map(([game, label, about]) => (
              <li key={game} className={game === 'absurd' ? 'first-free' : ''}>
                <a
                  href={routePath(base, game)}
                  aria-current={game === route.game ? 'page' : undefined}
                  onClick={follow({ game, practice: false })}
                >
                  <b>{t(label)}</b>
                  <small>{t(about)}</small>
                  {done.has(game) && (
                    <Check size={16} aria-label={t('今日は終了')} />
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {HAS_PRACTICE.has(route.game) && (
        <div className="cadence">
          {[false, true].map((practice) => (
            <a
              key={String(practice)}
              href={routePath(base, route.game, practice)}
              aria-current={route.practice === practice ? 'page' : undefined}
              onClick={follow({ ...route, practice })}
            >
              {practice ? t('練習') : t('今日の一問')}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
