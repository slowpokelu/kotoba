'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points. */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Undo2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { convertRomaji, previewKana } from '@/lib/kana-input.mjs';
import { resolveGuess } from '@/lib/game.mjs';
import {
  LADDER_LENGTH,
  checkRung,
  ladderGraph,
  ladderKey,
  ladderOutcome,
  ladderShare,
  makeLadder,
  restoreLadder,
  seeded,
  shortestPath,
} from '@/lib/ladder.mjs';
import {
  aliasesFor,
  answersFor,
  commonWords,
  wordValid as valid,
} from '@/lib/word-pools.mjs';
import { KanaKeyboard, useKanaField } from './kana-input';
import { useLanguage } from './language';
import { NextPuzzle } from './next-puzzle';
import { ShareButton, englishShare, jisho, useFinePointer } from './share';

type Round = {
  version: number;
  start: string;
  goal: string;
  par: number;
  steps: string[];
  gaveUp: boolean;
  draft: string;
};

const spellings = commonWords as Record<string, string>;
const three = (w: string) => [...w].length === LADDER_LENGTH;
// The par climbs through common words; rungs may be any dictionary word, so
// the full list only rules out pairs that rare words join too quickly.
// Built on first use.
let graph: ((word: string) => string[]) | null = null;
const commonGraph = () =>
  (graph ??= ladderGraph(Object.keys(spellings).filter(three)));
let anyGraph: ((word: string) => string[]) | null = null;
const fullGraph = () =>
  (anyGraph ??= ladderGraph([
    ...Object.keys(spellings).filter(three),
    ...[...valid].filter((w) => three(w) && !(w in spellings)),
  ]));
const ends = () =>
  answersFor(LADDER_LENGTH)
    .map((a) => a.reading)
    .filter((w) => w in spellings);
const aliases: Record<string, string> = Object.assign(
  Object.fromEntries(
    Object.entries(spellings)
      .filter(([r]) => three(r))
      .map(([r, k]) => [k, r]),
  ),
  aliasesFor(LADDER_LENGTH),
);

function newRound(day: string): Round {
  const ladder = makeLadder(
    ends(),
    commonGraph(),
    day ? seeded('ladder:' + day) : Math.random,
    fullGraph(),
  )!;
  return {
    version: 1,
    start: ladder.start,
    goal: ladder.goal,
    par: ladder.par!,
    steps: [],
    gaveUp: false,
    draft: '',
  };
}

export function Ladder({
  day,
  onPractice,
  onTyping,
}: {
  // Today's date for the daily ladder, or '' for practice.
  day: string;
  onPractice: () => void;
  onTyping: (typing: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const finePointer = useFinePointer();
  const [round, setRound] = useState<Round | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const key = ladderKey(day);

  useEffect(() => {
    let saved: Round | null = null;
    try {
      saved = restoreLadder(localStorage.getItem(key), valid);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    const fresh = newRound(day);
    if (
      saved &&
      day &&
      (saved.start !== fresh.start || saved.goal !== fresh.goal)
    )
      saved = null;
    setRound(saved ?? fresh);
    setMessage('');
  }, [key, day]);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(key, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round, key]);
  // Keep the newest rung in view as the ladder grows.
  const rungs = round?.steps.length ?? 0;
  useEffect(() => {
    const ladder = list.current;
    if (!ladder) return;
    const toNewest = () => (ladder.scrollTop = ladder.scrollHeight);
    toNewest();
    const observer = new ResizeObserver(toNewest);
    observer.observe(ladder);
    return () => observer.disconnect();
  }, [rungs]);

  const result = round ? ladderOutcome(round) : 'playing';
  const playing = result === 'playing';
  const kana = useKanaField(round?.draft ?? '', (draft) =>
    setRound((r) =>
      r && ladderOutcome(r) === 'playing'
        ? { ...r, draft: draft.slice(0, 40) }
        : r,
    ),
  );
  const draft = round ? resolveGuess(round.draft, aliases) : '';
  const tiles = [...previewKana(draft)].slice(0, LADDER_LENGTH);
  const goal = [...(round?.goal ?? '')];

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function submit() {
    if (!round || !playing || kana.composingNow()) return;
    const word = resolveGuess(convertRomaji(round.draft, true), aliases);
    const checked = checkRung(word, round, valid);
    if (checked.error) {
      say(checked.error, true);
      return;
    }
    const next = { ...round, steps: [...round.steps, word], draft: '' };
    setRound(next);
    say(
      word === round.goal ? 'ゴール！ ' + next.steps.length + '手でした。' : '',
    );
  }
  function undo() {
    if (!round || !playing || !round.steps.length) return;
    setRound({ ...round, steps: round.steps.slice(0, -1) });
    say('');
  }
  function again() {
    say('');
    if (day) onPractice();
    else setRound(newRound(''));
  }

  // As on the boards: a mouse looks words up mid-game, touch once it is over.
  const row = (word: string, previous: string | null, className = '') => {
    const kanaList = [...word];
    const cells = (
      <>
        <span className="ladder-tiles" aria-hidden="true">
          {Array.from({ length: LADDER_LENGTH }, (_, i) => (
            <span
              key={i}
              className={
                'tile filled' +
                (kanaList[i] && kanaList[i] === goal[i] ? ' correct' : '') +
                (previous && kanaList[i] !== [...previous][i]
                  ? ' changed'
                  : '') +
                className
              }
            >
              <span>{kanaList[i] ?? ''}</span>
            </span>
          ))}
        </span>
        <span className="ladder-word" lang="ja">
          {spellings[word] && spellings[word] !== word ? spellings[word] : ''}
        </span>
      </>
    );
    return finePointer || !playing ? (
      <a
        className="ladder-row"
        href={jisho(spellings[word] ?? word)}
        target="_blank"
        rel="noreferrer"
        title={t('辞書で見る')}
        // Keep the caret in the field while playing.
        onMouseDown={(e) => e.preventDefault()}
      >
        {cells}
      </a>
    ) : (
      <div className="ladder-row">{cells}</div>
    );
  };
  const path =
    round && !playing
      ? (shortestPath(round.start, round.goal, commonGraph()) ?? [])
      : [];
  return (
    <section className="play-area ladder" aria-label={t('ことばのはしご')}>
      <div className="board-column">
        <div className="game-heading">
          {day ? <h2>{day.replaceAll('-', ' / ')}</h2> : <span />}
          <span className="game-count">
            {t((round?.steps.length ?? 0) + '手')} ·{' '}
            {t('パー' + (round?.par ?? 0))}
          </span>
        </div>
        <ol className="ladder-rungs" ref={list} aria-label={t('はしご')}>
          {round && (
            <li
              className="ladder-rung start"
              aria-label={t('スタート：') + round.start}
            >
              {row(round.start, null)}
            </li>
          )}
          {round?.steps.map((word, i) => (
            <li key={i} className="ladder-rung" aria-label={word}>
              {row(word, i ? round.steps[i - 1] : round.start)}
            </li>
          ))}
          {playing && round && (
            <li className="ladder-rung active" aria-hidden="true">
              <div className="ladder-row">
                <span className="ladder-tiles">
                  {Array.from({ length: LADDER_LENGTH }, (_, i) => (
                    <span
                      key={i}
                      className={
                        'tile current' +
                        (tiles[i] ? ' filled' : '') +
                        (i === tiles.length ? ' caret' : '')
                      }
                    >
                      <span>{tiles[i] ?? ''}</span>
                    </span>
                  ))}
                </span>
                <span className="ladder-word" />
              </div>
            </li>
          )}
        </ol>
        {round && playing && (
          <div
            className="ladder-rung goal"
            aria-label={t('ゴール：') + round.goal}
          >
            {row(round.goal, null, ' correct')}
          </div>
        )}
      </div>
      <div className="control-column">
        {!playing && round ? (
          <section className="result-card" aria-label={t('結果')}>
            <span className="eyebrow">
              {result === 'won' ? t('ゴール！') : t('今回の答え')}
            </span>
            <h2 lang="ja">
              {round.start} → {round.goal}
            </h2>
            <p>
              {result !== 'won'
                ? t('パーは' + round.par + '手。')
                : round.steps.length < round.par
                  ? t(
                      round.steps.length +
                        '手でゴール。パーより' +
                        (round.par - round.steps.length) +
                        '手少ない！',
                    )
                  : round.steps.length === round.par
                    ? t(round.steps.length + '手でゴール。パーぴったり！')
                    : t(
                        round.steps.length +
                          '手でゴール。パーは' +
                          round.par +
                          '手。',
                      )}
            </p>
            <p className="ladder-path-label">{t('パーのはしご')}</p>
            <p className="ladder-path" lang="ja">
              {path.map((w, i) => (
                <span key={w}>
                  {i ? '→ ' : ''}
                  <a
                    href={jisho(spellings[w] ?? w)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {w}
                  </a>
                </span>
              ))}
            </p>
            <div className="result-actions">
              <button className="primary-button" onClick={again}>
                <RotateCcw size={17} />
                {t('もう一問')}
              </button>
              <ShareButton
                text={
                  language === 'en'
                    ? englishShare(ladderShare(round, day))
                    : ladderShare(round, day)
                }
              />
            </div>
            {day && <NextPuzzle />}
          </section>
        ) : (
          <>
            <div className="input-heading">
              <label htmlFor="guess">{t('ひらがな3文字')}</label>
              <span>{t('前の言葉から1文字だけ変える')}</span>
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
                placeholder={t('ここに入力')}
                aria-describedby="ladder-message"
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
            <div className="ladder-tools">
              <button
                className="text-button"
                onPointerDown={(e) => e.preventDefault()}
                disabled={!playing || !round?.steps.length}
                onClick={undo}
              >
                <Undo2 size={15} />
                {t('1つ戻る')}
              </button>
              <button
                className="text-button give-up"
                onPointerDown={(e) => e.preventDefault()}
                disabled={!playing}
                onClick={() => setGivingUp(true)}
              >
                {t('答えを見る')}
              </button>
            </div>
          </>
        )}
        <output
          id="ladder-message"
          aria-live="polite"
          className={'status ' + (error ? 'error' : '')}
        >
          {error ? t(message) : <span className="sr-only">{t(message)}</span>}
        </output>
        <KanaKeyboard
          disabled={!playing}
          finished={!playing}
          onInsert={(k) => {
            if (!kana.insert(k, LADDER_LENGTH))
              say(LADDER_LENGTH + '文字まで入力できます。', true);
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
            {t('パーのはしごを表示して、この問題を終了します。')}
          </AlertDialogDescription>
          <div className="dialog-actions">
            <button
              className="primary-button danger-button"
              onClick={() => {
                setGivingUp(false);
                if (round) {
                  setRound({ ...round, gaveUp: true, draft: '' });
                  say('');
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
