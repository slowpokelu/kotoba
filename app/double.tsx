'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points. */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Copy, RotateCcw, Share2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { convertRomaji, previewKana } from '@/lib/kana-input.mjs';
import {
  evaluate,
  labels,
  marks,
  resolveGuess,
  validateGuess,
} from '@/lib/game.mjs';
import {
  DOUBLE_KEY,
  DOUBLE_LIMIT,
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
import { KanaKeyboard, useKanaField } from './kana-input';
import { useLanguage } from './language';
import { englishShare, sendResult, useCanShare } from './share';

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

export function Double({
  picker,
  onTyping,
  hintSetting,
}: {
  picker: React.ReactNode;
  onTyping: (typing: boolean) => void;
  hintSetting: boolean;
}) {
  const { t, language } = useLanguage();
  const canShare = useCanShare();
  const [round, setRound] = useState<Round | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [revealing, setRevealing] = useState(-1);
  const [givingUp, setGivingUp] = useState(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let saved: Round | null = null;
    try {
      saved = restoreDouble(localStorage.getItem(DOUBLE_KEY), valid, answerSet);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    setRound(saved ?? newDouble(pool));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(DOUBLE_KEY, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round]);

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
      else if (state === 'lost')
        say('答えは「' + next.answers.join('」と「') + '」でした。');
    }, 650);
  }
  function restart() {
    if (busy) return;
    say('');
    setRound(newDouble(pool));
  }
  async function share() {
    if (!round) return;
    const text =
      language === 'en' ? englishShare(doubleShare(round)) : doubleShare(round);
    const sent = await sendResult(text, canShare);
    if (sent === 'copied') say('結果をコピーしました。');
    else if (sent === 'failed') say('コピーできませんでした。');
  }

  const turn = round ? round.guesses.length + (playing ? 1 : 0) : 1;
  return (
    <section className="play-area double" aria-label={t('ダブル')}>
      <div className="board-column">
        <div className="game-heading">
          {picker}
          <span>
            {Math.min(turn, DOUBLE_LIMIT)} / {DOUBLE_LIMIT}
          </span>
        </div>
        <div className="double-boards">
          {[0, 1].map((board) => {
            const solved = round ? solvedAt(round, board) : -1;
            return (
              <div
                key={board}
                className="board"
                data-length={4}
                style={{ '--rows': DOUBLE_LIMIT } as React.CSSProperties}
                aria-label={board ? t('右の解答欄') : t('左の解答欄')}
                aria-busy={busy}
              >
                {Array.from({ length: DOUBLE_LIMIT }, (_, r) => {
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
                  return (
                    <div
                      key={r}
                      className={
                        'guess-row' +
                        (revealing === r ? ' reveal' : '') +
                        (spent ? ' spent' : '')
                      }
                    >
                      {Array.from({ length: 4 }, (_, c) => {
                        const status = statuses[c] as Status | undefined;
                        return (
                          <span
                            key={c}
                            style={
                              {
                                '--delay': c * 85 + 'ms',
                              } as React.CSSProperties
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
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {round?.hints && (
          <div className="mode-chips">
            <b className="mode-badge hints">{t('ヒント')}</b>
          </div>
        )}
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
              <p>
                {t(round.guesses.length + ' / ' + DOUBLE_LIMIT + ' 回で正解。')}
              </p>
            )}
            <div className="result-actions">
              <button className="primary-button" onClick={restart}>
                <RotateCcw size={17} />
                {t('もう一問')}
              </button>
              <button className="secondary-button" onClick={share}>
                {canShare ? <Share2 size={17} /> : <Copy size={17} />}
                {canShare ? t('結果を共有') : t('結果をコピー')}
              </button>
            </div>
          </section>
        ) : (
          <>
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
                aria-label={t('ひらがな4文字')}
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
            (round ? splitKeys(round) : {}) as Record<
              string,
              [Status | null, Status | null]
            >
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
                  say('答えは「' + round.answers.join('」と「') + '」でした。');
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
