'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Delete, Shuffle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { convertRomaji } from '@/lib/kana-input.mjs';
import { resolveGuess } from '@/lib/game.mjs';
import {
  BEE_RANKS,
  beeKey,
  beePuzzle,
  beeRank,
  beeTotal,
  beeWords,
  checkBeeWord,
  restoreBee,
} from '@/lib/bee.mjs';
import { aliasesFor, commonWords } from '@/lib/word-pools.mjs';
import { useKanaField } from './kana-input';
import { useLanguage } from './language';
import { jisho, useFinePointer } from './share';

type Round = {
  version: number;
  found: string[];
  revealed: boolean;
  draft: string;
};

const spellings = commonWords as Record<string, string>;
const words = beeWords(commonWords);
// Kanji typed through an IME resolve to their reading.
const aliases: Record<string, string> = Object.assign(
  Object.fromEntries(Object.entries(spellings).map(([r, k]) => [k, r])),
  ...[3, 4, 5, 6].map(aliasesFor),
);
// The six outer cells around the centre, clockwise from the top.
const ring = [
  [0, -1],
  [0.87, -0.5],
  [0.87, 0.5],
  [0, 1],
  [-0.87, 0.5],
  [-0.87, -0.5],
];

export function Bee({
  picker,
  onTyping,
  day,
}: {
  picker: React.ReactNode;
  onTyping: (typing: boolean) => void;
  day: string;
}) {
  const { t } = useLanguage();
  const finePointer = useFinePointer();
  const puzzle = useMemo(() => (day ? beePuzzle(day, words) : null), [day]);
  const [round, setRound] = useState<Round | null>(null);
  const [outer, setOuter] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!puzzle) return;
    let saved: Round | null = null;
    try {
      saved = restoreBee(localStorage.getItem(beeKey(day)), puzzle);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    setRound(saved ?? { version: 1, found: [], revealed: false, draft: '' });
    setOuter(puzzle.outer);
    setMessage('');
  }, [puzzle, day]);
  useEffect(() => {
    if (!round || !day) return;
    try {
      localStorage.setItem(beeKey(day), JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round, day]);

  const playing = !!round && !round.revealed;
  const kana = useKanaField(round?.draft ?? '', (draft) =>
    setRound((r) =>
      r && !r.revealed ? { ...r, draft: draft.slice(0, 40) } : r,
    ),
  );
  const total = puzzle ? beeTotal(puzzle.answers) : 0;
  const points = round ? beeTotal(round.found) : 0;
  const rank = beeRank(points, total);
  const next = BEE_RANKS[rank.index + 1] as [number, string] | undefined;

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function submit() {
    if (!round || !puzzle || !playing || kana.composingNow()) return;
    const word = resolveGuess(convertRomaji(round.draft, true), aliases);
    const checked = checkBeeWord(word, puzzle, round.found);
    if (checked.error) {
      say(checked.error, true);
      return;
    }
    setRound({ ...round, found: [...round.found, word], draft: '' });
    say((checked.all ? '全部使った！ ' : 'いいね！ ') + '+' + checked.points);
  }
  function shuffle() {
    const cells = [...outer];
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    setOuter(cells);
  }

  const found = round
    ? [...(round.revealed ? (puzzle?.answers ?? []) : round.found)].sort(
        (a, b) => (a < b ? -1 : a > b ? 1 : 0),
      )
    : [];
  return (
    <section className="play-area bee" aria-label={t('かなビー')}>
      <div className="board-column">
        <div className="game-heading">
          {picker}
          <span>
            {t(points + '点')} · {t(rank.name)}
          </span>
        </div>
        <progress
          className="bee-progress"
          aria-label={t('進み具合')}
          max={total || 1}
          value={points}
        />
        <p className="bee-next">
          {next
            ? t(
                '「' +
                  next[1] +
                  '」まで ' +
                  Math.ceil(next[0] * total - points) +
                  '点',
              )
            : t('全部見つけました！')}
        </p>
        <ul className="bee-found" aria-label={t('見つけた言葉')}>
          {found.map((w) => (
            <li
              key={w}
              lang="ja"
              className={round?.found.includes(w) ? '' : 'missed'}
            >
              {round?.revealed || finePointer ? (
                <a
                  href={jisho(spellings[w] ?? w)}
                  target="_blank"
                  rel="noreferrer"
                  title={t('辞書で見る')}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {spellings[w] ?? w}
                </a>
              ) : (
                (spellings[w] ?? w)
              )}
            </li>
          ))}
          {!found.length && (
            <li className="bee-empty">
              {t(
                '7つのかなで言葉を作ろう。真ん中のかなは必ず使います。3文字以上。',
              )}
            </li>
          )}
        </ul>
        <p className="bee-count">
          {t(
            (round?.found.length ?? 0) +
              ' / ' +
              (puzzle?.answers.length ?? 0) +
              '語',
          )}
        </p>
      </div>
      <div className="control-column">
        <form
          className="guess-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            id="guess"
            {...kana.inputProps}
            disabled={!playing}
            placeholder={t('ここに入力')}
            aria-label={t('言葉')}
            aria-describedby="bee-message"
            aria-invalid={error || undefined}
            onFocus={() =>
              onTyping(window.matchMedia('(pointer: coarse)').matches)
            }
            onBlur={() => {
              onTyping(false);
              kana.commit();
            }}
          />
          <button
            type="submit"
            className="primary-button submit-button"
            onPointerDown={(e) => e.preventDefault()}
            disabled={!playing || !round?.draft.trim()}
            aria-label={t('回答する')}
          >
            {t('決定')}
            <ArrowRight size={18} />
          </button>
        </form>
        <button
          className="text-button give-up"
          onPointerDown={(e) => e.preventDefault()}
          disabled={!playing}
          onClick={() => setRevealing(true)}
        >
          {t('答えを見る')}
        </button>
        <output
          id="bee-message"
          aria-live="polite"
          className={'status ' + (error ? 'error' : '')}
        >
          {t(message)}
        </output>
        {puzzle && (
          <div className="honeycomb" aria-label={t('使えるかな')}>
            {[puzzle.center, ...outer].map((k, i) => (
              <button
                key={k}
                type="button"
                className={'cell' + (i ? '' : ' center')}
                style={
                  {
                    '--x': i ? ring[i - 1][0] : 0,
                    '--y': i ? ring[i - 1][1] : 0,
                  } as React.CSSProperties
                }
                disabled={!playing}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!kana.insert(k, 12))
                    say('12文字まで入力できます。', true);
                }}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <div className="bee-tools">
          <button
            type="button"
            disabled={!playing}
            onPointerDown={(e) => e.preventDefault()}
            onClick={kana.erase}
          >
            <Delete size={18} />
            {t('消す')}
          </button>
          <button
            type="button"
            disabled={!playing}
            onPointerDown={(e) => e.preventDefault()}
            onClick={shuffle}
          >
            <Shuffle size={18} />
            {t('シャッフル')}
          </button>
        </div>
      </div>
      <AlertDialog open={revealing} onOpenChange={setRevealing}>
        <AlertDialogContent
          className="help-dialog confirm-dialog"
          initialFocus={continueButton}
        >
          <AlertDialogTitle className="help-title">
            {t('答えを見ますか？')}
          </AlertDialogTitle>
          <AlertDialogDescription className="help-intro">
            {t('今日のかなビーを終えて、全部の言葉を表示します。')}
          </AlertDialogDescription>
          <div className="dialog-actions">
            <button
              className="primary-button danger-button"
              onClick={() => {
                setRevealing(false);
                if (round) {
                  setRound({ ...round, revealed: true, draft: '' });
                  say('');
                }
              }}
            >
              {t('答えを見る')}
            </button>
            <AlertDialogCancel
              ref={continueButton}
              className="secondary-button"
            >
              {t('続ける')}
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
