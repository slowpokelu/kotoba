'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
/* oxlint-disable typescript/no-misused-spread -- Kanji are counted as code points. */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { convertRomaji } from '@/lib/kana-input.mjs';
import {
  WADOU_LIMIT,
  checkKanji,
  dailyIndex,
  fits,
  restoreWadou,
  wadouKey,
  wadouOutcome,
  wadouShare,
} from '@/lib/wadou.mjs';
import { KanaKeyboard, useKanaField } from './kana-input';
import { useLanguage } from './language';
import { NextPuzzle } from './next-puzzle';
import { ShareButton, englishShare, jisho } from './share';

type Puzzle = { c: string; k: string[]; w: string[][] };
type Data = {
  puzzles: Puzzle[];
  words: Set<string>;
  readings: Record<string, string>;
};
type Round = {
  version: number;
  puzzle: number;
  guesses: string[];
  gaveUp: boolean;
  solved?: boolean;
  draft: string;
};

// The puzzles and every two-kanji word load only when the game opens.
let loading: Promise<Data> | null = null;
const loadData = () =>
  (loading ??= import('@/lib/wadou-data.mjs') as Promise<Data>);

// Clockwise from the top. Arrows follow the reading order of each word:
// [into the centre, out of it].
const SPOTS = ['top', 'right', 'bottom', 'left'] as const;
const ARROWS = {
  top: ['↓', '↑'],
  right: ['←', '→'],
  bottom: ['↑', '↓'],
  left: ['→', '←'],
};
const SPOT_NAMES = ['上', '右', '下', '左'];

function newRound(data: Data, day: string, previous = -1): Round {
  const count = data.puzzles.length;
  let puzzle = day ? dailyIndex(day, count) : -1;
  while (puzzle < 0 || puzzle === previous)
    puzzle = Math.floor(Math.random() * count);
  return { version: 1, puzzle, guesses: [], gaveUp: false, draft: '' };
}

export function Wadou({
  day,
  onPractice,
  onTyping,
}: {
  // Today's date for the daily puzzle, or '' for practice.
  day: string;
  onPractice: () => void;
  onTyping: (typing: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Data | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const key = wadouKey(day);

  useEffect(() => {
    let live = true;
    void loadData().then((loaded) => live && setData(loaded));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    let saved: Round | null = null;
    try {
      saved = restoreWadou(localStorage.getItem(key), data.puzzles.length);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    if (saved && day && saved.puzzle !== dailyIndex(day, data.puzzles.length))
      saved = null;
    setRound(saved ?? newRound(data, day));
    setMessage('');
  }, [data, key, day]);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(key, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round, key]);

  const puzzle = data && round ? data.puzzles[round.puzzle] : null;
  const result = puzzle && round ? wadouOutcome(round, puzzle) : 'playing';
  const playing = !!puzzle && result === 'playing';
  const kana = useKanaField(round?.draft ?? '', (draft) =>
    setRound((r) => (r ? { ...r, draft: draft.slice(0, 20) } : r)),
  );
  // Kana typed in the field turn into kanji to pick from.
  const reading = convertRomaji(round?.draft ?? '', true).trim();
  const candidates =
    data && /^[ぁ-ゖー]+$/.test(reading)
      ? [...(data.readings[reading] ?? '')].slice(0, 30)
      : [];
  // A single kanji in the field shows in the centre before it counts.
  const typed = round?.draft.trim() ?? '';
  const preview =
    playing && [...typed].length === 1 && /\p{Script=Han}/u.test(typed)
      ? typed
      : '';

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function submit() {
    if (!round || !puzzle || !data || !playing || kana.composingNow()) return;
    const checked = checkKanji(round.draft, round.guesses);
    if (checked.error) {
      say(
        candidates.length ? '候補から漢字を選んでください。' : checked.error,
        true,
      );
      return;
    }
    const guess = checked.guess!;
    const next: Round = {
      ...round,
      guesses: [...round.guesses, guess],
      draft: '',
      ...(guess === puzzle.c ? { solved: true } : {}),
    };
    setRound(next);
    const state = wadouOutcome(next, puzzle);
    const count = fits(guess, puzzle, data.words).filter(Boolean).length;
    if (state === 'won')
      say('正解！ ' + next.guesses.length + '回で見つけました。');
    else if (state === 'lost') say('答えは「' + puzzle.c + '」でした。');
    else say('「' + guess + '」は' + count + 'つの言葉になります。');
  }
  function again() {
    say('');
    if (day) onPractice();
    else if (data && round) setRound(newRound(data, '', round.puzzle));
  }

  const turn = round ? round.guesses.length + (playing ? 1 : 0) : 1;
  const centre = puzzle && !playing ? puzzle.c : preview;
  return (
    <section className="play-area wadou" aria-label={t('和同開珎')}>
      <div className="board-column">
        <div className="game-heading">
          {day ? <h2>{day.replaceAll('-', ' / ')}</h2> : <span />}
          <span className="game-count">
            {Math.min(turn, WADOU_LIMIT)} / {WADOU_LIMIT}
          </span>
        </div>
        <div
          className="wadou-cross"
          aria-label={t('真ん中の漢字を当てる')}
          aria-busy={!puzzle}
        >
          {puzzle?.k.map((clue, i) => {
            const spot = SPOTS[i];
            const out = clue.endsWith('>');
            return (
              <span key={spot} className="wadou-arm">
                <span
                  className={'wadou-clue ' + spot}
                  lang="ja"
                  aria-label={t(
                    SPOT_NAMES[i] +
                      '：「' +
                      [...clue][0] +
                      '」' +
                      (out ? '、真ん中から読む' : '、真ん中へ読む'),
                  )}
                >
                  {[...clue][0]}
                </span>
                <span className={'wadou-arrow ' + spot} aria-hidden="true">
                  {ARROWS[spot][out ? 1 : 0]}
                </span>
              </span>
            );
          })}
          <span
            className={
              'wadou-centre' +
              (result === 'won' ? ' won' : result === 'lost' ? ' lost' : '') +
              (preview ? ' preview' : '')
            }
            lang="ja"
          >
            {centre || '？'}
          </span>
        </div>
        <ol className="wadou-guesses" aria-label={t('回答')}>
          {Array.from({ length: WADOU_LIMIT }, (_, i) => {
            const guess = round?.guesses[i];
            const fit: boolean[] =
              guess && puzzle && data ? fits(guess, puzzle, data.words) : [];
            return (
              <li
                key={i}
                lang="ja"
                className={
                  'wadou-guess' +
                  (guess === puzzle?.c ? ' correct' : '') +
                  fit.map((ok, j) => (ok ? ' ' + SPOTS[j] : '')).join('')
                }
                aria-label={
                  guess
                    ? t(
                        '「' +
                          guess +
                          '」：' +
                          (fit.some(Boolean)
                            ? SPOT_NAMES.filter((_, j) => fit[j]).join('・') +
                              'と言葉になる'
                            : '言葉にならない'),
                      )
                    : t('未入力')
                }
              >
                {guess ?? ''}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="control-column">
        {!playing && puzzle && round ? (
          <section className="result-card" aria-label={t('結果')}>
            <span className="eyebrow">
              {result === 'won' ? t('正解') : t('今回の答え')}
            </span>
            <h2 lang="ja">{puzzle.c}</h2>
            {result === 'won' && (
              <p>
                {t(round.guesses.length + ' / ' + WADOU_LIMIT + ' 回で正解。')}
              </p>
            )}
            <ul className="wadou-words">
              {puzzle.w.map(([word, read]) => (
                <li key={word}>
                  <a
                    href={jisho(word)}
                    target="_blank"
                    rel="noreferrer"
                    lang="ja"
                  >
                    {word}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <span lang="ja">{read}</span>
                </li>
              ))}
            </ul>
            <div className="result-actions">
              <button className="primary-button" onClick={again}>
                <RotateCcw size={17} />
                {t('もう一問')}
              </button>
              {data && (
                <ShareButton
                  text={
                    language === 'en'
                      ? englishShare(wadouShare(round, puzzle, data.words, day))
                      : wadouShare(round, puzzle, data.words, day)
                  }
                />
              )}
            </div>
            {day && <NextPuzzle />}
          </section>
        ) : (
          <>
            <div className="input-heading">
              <label htmlFor="guess">{t('漢字1文字')}</label>
              <span>{t('かなで読みを入れると候補が出ます')}</span>
            </div>
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
                placeholder={t('漢字か読み')}
                aria-describedby="wadou-message"
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
              onClick={() => setGivingUp(true)}
            >
              {t('答えを見る')}
            </button>
          </>
        )}
        {playing && candidates.length > 0 && (
          <div className="kanji-candidates" aria-label={t('候補')}>
            {candidates.map((k) => (
              <button
                key={k}
                type="button"
                lang="ja"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setRound((r) => (r ? { ...r, draft: k } : r))}
              >
                {k}
              </button>
            ))}
          </div>
        )}
        <output
          id="wadou-message"
          aria-live="polite"
          className={'status ' + (error ? 'error' : '')}
        >
          {error ? t(message) : <span className="sr-only">{t(message)}</span>}
        </output>
        <KanaKeyboard
          disabled={!playing}
          finished={!playing}
          onInsert={(k) => {
            if (!kana.insert(k, 8)) say('8文字まで入力できます。', true);
          }}
          onModify={kana.modify}
          onErase={kana.erase}
        />
      </div>
      <AlertDialog open={givingUp} onOpenChange={setGivingUp}>
        <AlertDialogContent
          className="help-dialog confirm-dialog"
          initialFocus={continueButton}
        >
          <AlertDialogTitle className="help-title">
            {t('ここで終了しますか？')}
          </AlertDialogTitle>
          <AlertDialogDescription className="help-intro">
            {t('答えを表示して、この問題を終了します。')}
          </AlertDialogDescription>
          <div className="dialog-actions">
            <button
              className="primary-button danger-button"
              onClick={() => {
                setGivingUp(false);
                if (round && puzzle) {
                  setRound({ ...round, gaveUp: true, draft: '' });
                  say('答えは「' + puzzle.c + '」でした。');
                }
              }}
            >
              {t('終了して答えを見る')}
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
