'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points. */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { convertRomaji, previewKana } from '@/lib/kana-input.mjs';
import {
  dailyAnswer,
  evaluate,
  labels,
  marks,
  resolveGuess,
  validateGuess,
} from '@/lib/game.mjs';
import { answers as dailyPool } from '@/lib/answers.mjs';
import {
  boardsKey,
  boardsLimit,
  dailyAnswers,
  doubleOutcome,
  doubleShare,
  newDouble,
  restoreDouble,
  solvedAt,
  splitKeys,
} from '@/lib/double.mjs';
import {
  allAnswers,
  allValid as valid,
  aliasesFor,
  answerSet,
  answersFor,
} from '@/lib/word-pools.mjs';
import type { Status } from '@/lib/types';
import { KanaKeyboard, boardNames, useKanaField } from './kana-input';
import { Legend, ModeChips } from './legend';
import { NextPuzzle } from './next-puzzle';
import { useLanguage } from './language';
import { ShareButton, englishShare, jisho, useFinePointer } from './share';

type Round = {
  version: number;
  answers: string[];
  guesses: string[];
  draft: string;
  gaveUp: boolean;
  hints?: boolean;
};

const pool = answersFor(4).map((a) => a.reading);
const spelling = new Map(allAnswers.map((a) => [a.reading, a.spelling]));
const aliases = aliasesFor(4);
const answersText = (answers: string[]) =>
  '答えは「' +
  answers.join(answers.length > 2 ? '」「' : '」と「') +
  '」でした。';

// ダブル and トリプル: one guess goes on every board. Today's round is the
// same for everyone; practice deals new words each time.
export function Double({
  boards,
  day,
  onPractice,
  onTyping,
  hintSetting,
}: {
  boards: 2 | 3;
  // Today's date for the daily round, or '' for practice.
  day: string;
  onPractice: () => void;
  onTyping: (typing: boolean) => void;
  hintSetting: boolean;
}) {
  const { t, language } = useLanguage();
  const finePointer = useFinePointer();
  const [round, setRound] = useState<Round | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [revealing, setRevealing] = useState(-1);
  const [givingUp, setGivingUp] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = boardsLimit(boards);
  const key = boardsKey(boards, day);
  const names = boardNames(boards);

  useEffect(() => {
    let saved: Round | null = null;
    try {
      saved = restoreDouble(
        localStorage.getItem(key),
        valid,
        answerSet,
        boards,
      );
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    // Today's words are a fixed draw, apart from the day's ことば.
    const next = newDouble(pool, Math.random, boards);
    if (day)
      next.answers = dailyAnswers(day, pool, boards, [
        dailyAnswer(day, dailyPool).reading,
      ]);
    setRound(
      saved && (!day || saved.answers.join() === next.answers.join())
        ? saved
        : next,
    );
    setMessage('');
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, boards, day]);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(key, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round, key]);

  const result = round ? doubleOutcome(round) : 'playing';
  const playing = result === 'playing';
  const busy = revealing >= 0;
  const kana = useKanaField(round?.draft ?? '', (draft) =>
    setRound((r) =>
      r && doubleOutcome(r) === 'playing'
        ? { ...r, draft: draft.slice(0, 40) }
        : r,
    ),
  );
  const draft = round ? resolveGuess(round.draft, aliases) : '';
  const tiles = [...previewKana(draft)].slice(0, 4);

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function submit() {
    if (!round || !playing || busy || kana.composingNow()) return;
    const checked = validateGuess(
      convertRomaji(round.draft, true),
      round.guesses,
      valid,
      aliases,
      4,
    );
    if (checked.error) {
      say(checked.error, true);
      return;
    }
    // A round takes the hint mode at its first guess, as in the main game.
    const next: Round = {
      ...round,
      ...(round.guesses.length === 0 && hintSetting ? { hints: true } : {}),
      guesses: [...round.guesses, checked.guess!],
      draft: '',
    };
    setRound(next);
    setRevealing(round.guesses.length);
    say('');
    timer.current = setTimeout(() => {
      setRevealing(-1);
      const state = doubleOutcome(next);
      if (state === 'won')
        say('正解！ ' + next.guesses.length + '回で見つけました。');
      else if (state === 'lost') say(answersText(next.answers));
    }, 650);
  }
  function restart() {
    if (busy) return;
    say('');
    // Today's round leads on to practice, as in the main game.
    if (day) onPractice();
    else setRound(newDouble(pool, Math.random, boards));
  }

  const turn = round ? round.guesses.length + (playing ? 1 : 0) : 1;
  // A round follows the setting until its first guess, then keeps its mode.
  const hints = round?.guesses.length ? !!round.hints : hintSetting;
  const label = boards === 3 ? 'トリプル' : 'ダブル';
  return (
    <section
      className={'play-area double' + (boards === 3 ? ' triple' : '')}
      aria-label={t(label)}
    >
      <div className="board-column">
        <div className="game-heading">
          {day ? <h2>{day.replaceAll('-', ' / ')}</h2> : <span />}
          <span className="game-count">
            <ModeChips hard={false} hints={hints} />
            {Math.min(turn, limit)} / {limit}
          </span>
        </div>
        <div className="double-boards">
          {names.map((name, board) => {
            const solved = round ? solvedAt(round, board) : -1;
            return (
              <div
                key={board}
                className="board"
                data-length={4}
                style={{ '--rows': limit } as React.CSSProperties}
                aria-label={t(name + 'の解答欄')}
                aria-busy={busy}
              >
                {Array.from({ length: limit }, (_, r) => {
                  const guess = round?.guesses[r];
                  // After its solve, a board's later rows stay empty.
                  const spent = solved >= 0 && r > solved;
                  const statuses =
                    guess && round && !spent
                      ? evaluate(guess, round.answers[board], round.hints)
                      : [];
                  const active =
                    !!round &&
                    playing &&
                    solved < 0 &&
                    r === round.guesses.length;
                  const letters =
                    guess && !spent ? [...guess] : active ? tiles : [];
                  const cells = Array.from({ length: 4 }, (_, c) => {
                    const status = statuses[c] as Status | undefined;
                    return (
                      <span
                        key={c}
                        style={
                          { '--delay': c * 85 + 'ms' } as React.CSSProperties
                        }
                        className={
                          'tile ' +
                          (status || '') +
                          (active ? ' current' : '') +
                          (active && c === tiles.length ? ' caret' : '') +
                          (letters[c] ? ' filled' : '')
                        }
                        aria-label={
                          letters[c]
                            ? t(
                                c +
                                  1 +
                                  '文字目 ' +
                                  letters[c] +
                                  (status ? '、' + labels[status] : ''),
                              )
                            : t('未入力')
                        }
                      >
                        <span>{letters[c] || ''}</span>
                        {status && (
                          <small aria-hidden="true">{marks[status]}</small>
                        )}
                      </span>
                    );
                  });
                  const className =
                    'guess-row' +
                    (revealing === r ? ' reveal' : '') +
                    (spent ? ' spent' : '');
                  // Guesses link to the dictionary as on the main board.
                  return guess &&
                    !spent &&
                    (!playing || finePointer) &&
                    revealing !== r ? (
                    <a
                      key={r}
                      className={className}
                      href={jisho(
                        round?.answers.includes(guess)
                          ? (spelling.get(guess) ?? guess)
                          : guess,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t(
                        '第' + (r + 1) + '回答：' + guess + '、辞書で見る',
                      )}
                      title={t('辞書で見る')}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {cells}
                    </a>
                  ) : (
                    <div key={r} className={className}>
                      {cells}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <Legend hints={hints} />
      </div>
      <div className="control-column">
        {!playing && !busy && round ? (
          <section className="result-card" aria-label={t('結果')}>
            <span className="eyebrow">
              {result === 'won' ? t('正解') : t('今回の答え')}
            </span>
            <h2 lang="ja">
              {round.answers.map((a) => spelling.get(a) ?? a).join('・')}
            </h2>
            <p className="answer-reading">{round.answers.join('・')}</p>
            {result === 'won' && (
              <p>{t(round.guesses.length + ' / ' + limit + ' 回で正解。')}</p>
            )}
            <div className="result-actions">
              <button className="primary-button" onClick={restart}>
                <RotateCcw size={17} />
                {t('もう一問')}
              </button>
              <ShareButton
                text={
                  language === 'en'
                    ? englishShare(doubleShare(round, day))
                    : doubleShare(round, day)
                }
              />
            </div>
            <p className="dictionary-links">
              {round.answers.map((a) => (
                <a
                  key={a}
                  className="dictionary-link"
                  href={jisho(spelling.get(a) ?? a)}
                  target="_blank"
                  rel="noreferrer"
                  lang="ja"
                  aria-label={t((spelling.get(a) ?? a) + '、辞書で見る')}
                >
                  {spelling.get(a) ?? a}
                  <ExternalLink size={14} />
                </a>
              ))}
            </p>
            {day && <NextPuzzle />}
          </section>
        ) : (
          <>
            <div className="input-heading">
              <label htmlFor="guess">{t('ひらがな4文字')}</label>
              <span>{t('小さい「ゃ・ゅ・ょ・っ」も1文字')}</span>
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
                readOnly={busy}
                placeholder={t('ここに入力')}
                aria-describedby="double-message"
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
                disabled={!playing || busy || !round?.draft.trim()}
                aria-label={t('回答する')}
              >
                {t('決定')}
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button give-up"
              onPointerDown={(e) => e.preventDefault()}
              disabled={!playing || busy}
              onClick={() => setGivingUp(true)}
            >
              {t('答えを見る')}
            </button>
          </>
        )}
        <output
          id="double-message"
          aria-live="polite"
          className={'status ' + (error ? 'error' : '')}
        >
          {error ? t(message) : <span className="sr-only">{t(message)}</span>}
        </output>
        <KanaKeyboard
          split={
            (round ? splitKeys(round) : {}) as Record<string, (Status | null)[]>
          }
          disabled={!playing || busy}
          finished={!playing}
          onInsert={(k) => {
            if (!kana.insert(k, 4)) say('4文字まで入力できます。', true);
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
                if (round) {
                  setRound({ ...round, gaveUp: true, draft: '' });
                  say(answersText(round.answers));
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
