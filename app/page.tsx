'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state and event handlers manage IME timing. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points, including small kana. */

import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  ArrowRight,
  Copy,
  RotateCcw,
  X,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { answers } from '@/lib/answers.mjs';
import { convertRomaji, previewKana } from '@/lib/kana-input.mjs';
import { KanaKeyboard, useKanaField } from './kana-input';
import { PlayerTools } from './player-tools';
import { LanguageProvider, LanguageSwitcher, useLanguage } from './language';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  allAnswers,
  allValid as valid,
  answerSet,
  answersFor,
  aliasesFor,
  dictionaryUpdated,
} from '@/lib/word-pools.mjs';
import {
  LIMIT,
  PRACTICE_LENGTHS,
  PRACTICE_LENGTH_KEY,
  practiceId,
  savedPracticeLength,
  resolveGuess,
  evaluate,
  keyboardStates,
  dailyAnswer,
  localDay,
  validateGuess,
  newGame,
  restoreGame,
  outcome,
  shareText,
  labels,
  marks,
  HINTS_KEY,
  HARD_KEY,
  hardModeError,
} from '@/lib/game.mjs';
import { gameKey } from '@/lib/profile.mjs';
import type { Game, Status } from '@/lib/types';

type Mode = 'daily' | 'practice';
function loadGame(fallback: Game) {
  try {
    return restoreGame(
      localStorage.getItem(gameKey(fallback.id)),
      fallback,
      valid,
      answerSet,
    ) as Game;
  } catch {
    return fallback;
  }
}
function pickPractice(length = 4, previous = '') {
  const choices = answersFor(length).filter((a) => a.reading !== previous);
  const number = new Uint32Array(1);
  crypto.getRandomValues(number);
  return choices[number[0] % choices.length].reading;
}

// Counts down to local midnight, when the next daily puzzle starts.
function NextPuzzle() {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const left = Math.max(0, midnight.getTime() - now);
  const time = [3600000, 60000, 1000]
    .map((unit, i) =>
      String(Math.floor(left / unit) % (i ? 60 : 24)).padStart(2, '0'),
    )
    .join(':');
  return (
    <p className="next-day">
      {t('次の一問まで')} <time>{time}</time>
    </p>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <GameView />
    </LanguageProvider>
  );
}
function GameView() {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceLength, setPracticeLength] = useState(4);
  const [hintSetting, setHintSetting] = useState(false);
  const [hardSetting, setHardSetting] = useState(false);
  const [day, setDay] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [help, setHelp] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [revealing, setRevealing] = useState(-1);
  const [copyFallback, setCopyFallback] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  // Finish announcements are for screen readers; the result card shows them.
  const [quiet, setQuiet] = useState(false);
  // Bumped on every refused guess to replay the row's shake.
  const [shake, setShake] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const againButton = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  const kana = useKanaField(game?.draft || '', edit);
  const field = kana.field;
  // A mouse can look up guesses mid-game; touch waits for the result so a
  // stray tap near the keyboard never leaves the puzzle.
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // iOS Safari lays its keyboard over the page instead of resizing it, then
  // scrolls the page to reveal the field. While a phone types in the field,
  // size the layout to the area left above the keyboard instead.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!typing) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const fit = () => {
      root.style.setProperty(
        '--visible-height',
        (viewport?.height ?? window.innerHeight) + 'px',
      );
      window.scrollTo(0, 0);
    };
    fit();
    viewport?.addEventListener('resize', fit);
    return () => {
      viewport?.removeEventListener('resize', fit);
      root.style.removeProperty('--visible-height');
      window.scrollTo(0, 0);
    };
  }, [typing]);
  // Phones share through the system sheet; computers copy.
  useEffect(() => {
    setCanShare(
      typeof navigator.share === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    );
  }, []);
  // On a computer, typing anywhere goes into the field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const input = field.current;
      const target = e.target as HTMLElement | null;
      if (
        !input ||
        input.disabled ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.isComposing ||
        target?.closest('input, textarea, select, [role="dialog"]') ||
        (e.key === ' ' && target?.closest('button, a, [role="tab"]')) ||
        (e.key.length !== 1 && e.key !== 'Backspace')
      )
        return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [field]);
  const currentDay = useRef('');
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const today = localDay();
    currentDay.current = today;
    setDay(today);
    try {
      setPracticeLength(savedPracticeLength(localStorage));
      setHintSetting(localStorage.getItem(HINTS_KEY) === '1');
      setHardSetting(localStorage.getItem(HARD_KEY) === '1');
    } catch {
      /* Use four kana if browser storage is unavailable. */
    }
    setGame(
      loadGame(newGame(dailyAnswer(today, answers).reading, 'daily:' + today)),
    );
    const tick = setInterval(() => {
      const next = localDay();
      if (next !== currentDay.current) {
        currentDay.current = next;
        setDay(next);
        if (modeRef.current === 'daily') {
          setGivingUp(false);
          if (timer.current) clearTimeout(timer.current);
          busy.current = false;
          setRevealing(-1);
          setGame(
            loadGame(
              newGame(dailyAnswer(next, answers).reading, 'daily:' + next),
            ),
          );
          setError(false);
          setMessage('新しい一問が届きました。');
        }
      }
    }, 15000);
    return () => {
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(gameKey(game.id), JSON.stringify(game));
    } catch {
      setStorageWarning(true);
    }
  }, [game]);

  const result = game ? outcome(game) : 'playing';
  const length = mode === 'daily' ? 4 : practiceLength;
  const aliases = aliasesFor(length);
  const finished = result !== 'playing';
  // A round follows the setting until its first guess, then keeps that mode.
  const showHints = game?.guesses.length ? !!game.hints : hintSetting;
  const showHard = game?.guesses.length ? !!game.hard : hardSetting;
  const keys = (
    game ? keyboardStates(game.guesses, game.answer, game.hints) : {}
  ) as Record<string, Status>;
  const draft = game ? resolveGuess(game.draft, aliases) : '';
  const tiles = [...previewKana(draft)].slice(0, length);
  const answer = game
    ? allAnswers.find((a) => a.reading === game.answer)
    : null;

  useEffect(() => {
    if (
      finished &&
      revealing < 0 &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      againButton.current?.focus({ preventScroll: true });
  }, [finished, revealing]);
  function savePreference(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      setStorageWarning(true);
    }
  }
  function say(text: string, isError = false, isQuiet = false) {
    setMessage(text);
    setError(isError);
    setQuiet(isQuiet);
    if (isError) setShake((n) => n + 1);
  }
  function edit(value: string) {
    const current = gameRef.current;
    if (!current || outcome(current) !== 'playing' || busy.current) return;
    const next = { ...current, draft: value.slice(0, 40) };
    gameRef.current = next;
    setGame(next);
    say('');
  }
  function switchMode(value: unknown) {
    const next = value as Mode;
    if (next === mode || busy.current) return;
    const id =
      next === 'daily'
        ? 'daily:' + currentDay.current
        : practiceId(practiceLength);
    const chosen =
      next === 'daily'
        ? dailyAnswer(currentDay.current, answers).reading
        : pickPractice(practiceLength);
    setMode(next);
    setGame(loadGame(newGame(chosen, id)));
    say('');
    setCopyFallback('');
    setRevealing(-1);
  }
  function again() {
    if (busy.current) return;
    setGame(
      newGame(
        pickPractice(practiceLength, game?.answer),
        practiceId(practiceLength),
      ),
    );
    setMode('practice');
    say('');
    setCopyFallback('');
    setRevealing(-1);
  }
  function chooseLength(value: unknown) {
    const next = Number(value);
    if (
      !PRACTICE_LENGTHS.includes(next) ||
      next === practiceLength ||
      busy.current
    )
      return;
    setPracticeLength(next);
    setGame(loadGame(newGame(pickPractice(next), practiceId(next))));
    setGivingUp(false);
    setCopyFallback('');
    say('');
    savePreference(PRACTICE_LENGTH_KEY, String(next));
  }
  function giveUp() {
    const current = gameRef.current;
    if (!current || busy.current || outcome(current) !== 'playing') return;
    const next = { ...current, gaveUp: true, draft: '' };
    gameRef.current = next;
    setGame(next);
    setGivingUp(false);
    say('答えは「' + next.answer + '」でした。', false, true);
  }
  function insert(k: string) {
    if (!game || finished || busy.current) return;
    if (!kana.insert(k, length)) say(`${length}文字まで入力できます。`, true);
  }
  function submit() {
    const current = gameRef.current;
    if (
      !current ||
      outcome(current) !== 'playing' ||
      busy.current ||
      kana.composingNow()
    )
      return;
    // Keep keyboard entry continuous, including after clicking the submit button.
    // On touch screens only when the field already has focus: focusing it would
    // open the phone keyboard on top of the kana keys.
    if (
      document.activeElement === field.current ||
      !window.matchMedia('(pointer: coarse)').matches
    )
      field.current?.focus({ preventScroll: true });
    const committed = convertRomaji(current.draft, true);
    const checked = validateGuess(
      committed,
      current.guesses,
      valid,
      aliases,
      length,
    );
    if (checked.error) {
      if (committed !== current.draft) edit(committed);
      say(checked.error, true);
      return;
    }
    const guess = checked.guess!;
    const rule = current.hard ? hardModeError(guess, current) : null;
    if (rule) {
      say(rule, true);
      return;
    }
    busy.current = true;
    const next = {
      ...current,
      ...(current.guesses.length === 0 && hintSetting ? { hints: true } : {}),
      ...(current.guesses.length === 0 && hardSetting ? { hard: true } : {}),
      guesses: [...current.guesses, guess],
      draft: '',
    };
    gameRef.current = next;
    setGame(next);
    setRevealing(current.guesses.length);
    say('');
    timer.current = setTimeout(() => {
      busy.current = false;
      setRevealing(-1);
      const state = outcome(next);
      if (state === 'won')
        say(
          '正解！ ' + next.guesses.length + '回で見つけました。',
          false,
          true,
        );
      else if (state === 'lost')
        say('答えは「' + next.answer + '」でした。', false, true);
      else
        say(
          guess +
            '：' +
            evaluate(guess, next.answer, next.hints)
              .map(
                (s: string, i: number) =>
                  i + 1 + '文字目 ' + labels[s as Status],
              )
              .join('、'),
        );
    }, 650);
  }

  async function copy() {
    if (!game) return;
    const text =
      language === 'en'
        ? shareText(game, day)
            .replace('ことば', 'Kotoba')
            .replace('練習', 'Practice')
            .replace('[ハード]', '[Hard]')
            .replace('[ヒント]', '[Hints]')
            .replace(/(\d)文字/, '$1 kana')
        : shareText(game, day);
    if (canShare)
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // Any other failure falls back to copying.
      }
    try {
      await navigator.clipboard.writeText(text);
      setCopyFallback('');
      say('結果をコピーしました。');
    } catch {
      setCopyFallback(text);
      say('下の結果を選択してコピーできます。');
    }
  }

  return (
    <main className={'shell' + (typing ? ' typing' : '')}>
      <header className="masthead">
        <h1>
          ことば
          <span className="seal" aria-hidden="true">
            四
          </span>
        </h1>
        <div className="header-actions">
          <LanguageSwitcher />
          <PlayerTools
            game={game}
            day={day}
            busy={revealing >= 0}
            practiceLength={practiceLength}
            hints={hintSetting}
            hard={hardSetting}
            onHardChange={(value) => {
              setHardSetting(value);
              savePreference(HARD_KEY, value ? '1' : '0');
            }}
            onHintsChange={(value) => {
              setHintSetting(value);
              savePreference(HINTS_KEY, value ? '1' : '0');
            }}
            onImport={() => {
              if (!game || busy.current) return;
              const nextLength = savedPracticeLength(localStorage);
              setHintSetting(localStorage.getItem(HINTS_KEY) === '1');
              setHardSetting(localStorage.getItem(HARD_KEY) === '1');
              setPracticeLength(nextLength);
              const restored = loadGame(
                mode === 'daily'
                  ? newGame(game.answer, game.id)
                  : newGame(pickPractice(nextLength), practiceId(nextLength)),
              );
              gameRef.current = restored;
              setGame(restored);
              say(t('記録を読み込みました。'));
            }}
          />
          <button
            className="icon-button"
            aria-label={t('遊び方')}
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={21} />
          </button>
        </div>
      </header>
      <Tabs value={mode} onValueChange={switchMode} className="game-tabs">
        <TabsList aria-label={t('ゲームモード')} className="mode-list">
          <TabsTrigger value="daily" disabled={revealing >= 0}>
            {t('今日の一問')}
          </TabsTrigger>
          <TabsTrigger value="practice" disabled={revealing >= 0}>
            {t('練習')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={mode} className="game-panel">
          <section
            className="play-area"
            aria-label={mode === 'daily' ? t('今日の一問') : t('練習')}
          >
            <div className="board-column">
              <div className="game-heading">
                {mode === 'practice' ? (
                  <div className="length-picker">
                    <span id="length-label">{t('文字数')}</span>
                    <RadioGroup
                      className="length-options"
                      aria-labelledby="length-label"
                      value={String(practiceLength)}
                      onValueChange={chooseLength}
                      disabled={revealing >= 0}
                    >
                      {PRACTICE_LENGTHS.map((n) => (
                        <label
                          className="length-choice"
                          key={n}
                          onPointerDown={(e) => e.preventDefault()}
                        >
                          <RadioGroupItem
                            value={String(n)}
                            aria-label={t(`${n}文字`)}
                            className="length-radio"
                          />
                          <span aria-hidden="true">{n}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ) : (
                  <h2>{day ? day.replaceAll('-', ' / ') : t('今日の一問')}</h2>
                )}
                <span>
                  {game
                    ? Math.min(game.guesses.length + (finished ? 0 : 1), LIMIT)
                    : 1}{' '}
                  / {LIMIT}
                </span>
              </div>
              <div
                className="board"
                data-length={length}
                aria-label={t('8回の解答欄')}
                aria-busy={revealing >= 0}
              >
                {Array.from({ length: LIMIT }, (_, r) => {
                  const guess = game?.guesses[r];
                  const statuses =
                    guess && game
                      ? evaluate(guess, game.answer, game.hints)
                      : [];
                  const active =
                    !!game && !finished && r === game.guesses.length;
                  const letters = guess ? [...guess] : active ? tiles : [];
                  const lookup =
                    guess && (finished || finePointer) && revealing !== r
                      ? 'https://jisho.org/search/' +
                        encodeURIComponent(
                          guess === game?.answer && answer
                            ? answer.spelling
                            : guess,
                        )
                      : '';
                  const label = guess
                    ? '第' + (r + 1) + '回答：' + guess
                    : '第' + (r + 1) + '回答';
                  const cells = (
                    <>
                      <span
                        className={'row-number ' + (active ? 'active' : '')}
                      >
                        {String(r + 1).padStart(2, '0')}
                      </span>
                      {Array.from({ length }, (_, c) => {
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
                            aria-label={t(
                              letters[c]
                                ? c +
                                    1 +
                                    '文字目 ' +
                                    letters[c] +
                                    (status ? '、' + labels[status] : '')
                                : t('未入力'),
                            )}
                          >
                            <span>{letters[c] || ''}</span>
                            {status && (
                              <small aria-hidden="true">{marks[status]}</small>
                            )}
                          </span>
                        );
                      })}
                    </>
                  );
                  const className =
                    'guess-row' +
                    (revealing === r ? ' reveal' : '') +
                    (active && error && shake ? ' shake' : '');
                  return lookup ? (
                    <a
                      className={className}
                      key={r}
                      href={lookup}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t(label + '、辞書で見る')}
                      title={t('辞書で見る')}
                      // Keep the caret in the guess field while playing.
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {cells}
                    </a>
                  ) : (
                    <div
                      className={className}
                      key={active ? r + '-' + shake : r}
                      aria-label={t(label)}
                    >
                      {cells}
                    </div>
                  );
                })}
              </div>
              {(showHard || showHints) && (
                <div className="mode-chips" aria-label={t('この問題のモード')}>
                  {showHard && <b className="mode-badge hard">{t('ハード')}</b>}
                  {showHints && (
                    <b className="mode-badge hints">{t('ヒント')}</b>
                  )}
                </div>
              )}
              <div className="legend" aria-label={t('色と記号の意味')}>
                <span>
                  <i className="correct">✓</i>
                  {t('位置も一致')}
                </span>
                <span>
                  <i className="present">●</i>
                  {t('別の位置')}
                </span>
                {showHints && (
                  <span>
                    <i className="near-correct">✓</i>
                    <i className="near-present">●</i>
                    {t('濁点・大小違い')}
                  </span>
                )}
                <span>
                  <i className="absent">−</i>
                  {t('なし')}
                </span>
              </div>
            </div>
            <div className="control-column">
              {finished && revealing < 0 ? (
                <section className="result-card" aria-label={t('結果')}>
                  <span className="eyebrow">
                    {result === 'won' ? t('正解') : t('今回の答え')}
                  </span>
                  <h2>{answer?.spelling}</h2>
                  <p className="answer-reading">{game?.answer}</p>
                  {result === 'won' && (
                    <p>
                      {t(game?.guesses.length + ' / ' + LIMIT + ' 回で正解。')}
                    </p>
                  )}
                  <div className="result-actions">
                    <button
                      className="primary-button"
                      ref={againButton}
                      onClick={again}
                    >
                      <RotateCcw size={17} />
                      {t('もう一問')}
                    </button>
                    <button className="secondary-button" onClick={copy}>
                      {canShare ? <Share2 size={17} /> : <Copy size={17} />}
                      {canShare ? t('結果を共有') : t('結果をコピー')}
                    </button>
                  </div>
                  <a
                    className="dictionary-link"
                    href={
                      'https://jisho.org/search/' +
                      encodeURIComponent(answer?.spelling || '')
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('辞書で見る')}
                    <ExternalLink size={14} />
                  </a>
                  {mode === 'daily' && <NextPuzzle />}
                  {copyFallback && (
                    <textarea
                      className="share-fallback"
                      aria-label={t('コピー用の結果')}
                      readOnly
                      value={copyFallback}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  )}
                </section>
              ) : (
                <>
                  <div className="input-heading">
                    <label htmlFor="guess">{t(`ひらがな${length}文字`)}</label>
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
                      disabled={!game || finished}
                      readOnly={revealing >= 0}
                      placeholder={t('ここに入力')}
                      aria-describedby="game-message"
                      aria-invalid={error || undefined}
                      onFocus={() =>
                        setTyping(
                          window.matchMedia('(pointer: coarse)').matches,
                        )
                      }
                      onBlur={() => {
                        setTyping(false);
                        if (game) kana.commit();
                      }}
                    />
                    <button
                      type="submit"
                      className="primary-button submit-button"
                      // Tapping 決定 must not close the phone keyboard mid-typing.
                      onPointerDown={(e) => e.preventDefault()}
                      disabled={
                        !game ||
                        !game.draft.trim() ||
                        finished ||
                        revealing >= 0
                      }
                      aria-label={t('回答する')}
                    >
                      {t('決定')}
                      <ArrowRight size={18} />
                    </button>
                  </form>
                  <button
                    className="text-button give-up"
                    // Keep the field focused: closing the phone keyboard first
                    // would move this button out from under the tap.
                    onPointerDown={(e) => e.preventDefault()}
                    disabled={!game || revealing >= 0}
                    onClick={() => setGivingUp(true)}
                  >
                    {t('答えを見る')}
                  </button>
                </>
              )}
              <output
                id="game-message"
                aria-live="polite"
                aria-atomic="true"
                className={'status ' + (error ? 'error' : '')}
              >
                {error || (finished && !quiet) ? (
                  t(message)
                ) : (
                  <>
                    <span aria-hidden="true">
                      {revealing >= 0 ? t('答え合わせ…') : null}
                    </span>
                    <span className="sr-only">{t(message)}</span>
                  </>
                )}
              </output>
              <KanaKeyboard
                keys={keys}
                disabled={!game || finished || revealing >= 0}
                finished={finished}
                onInsert={insert}
                onModify={kana.modify}
                onErase={() => game && kana.erase()}
              />
              {storageWarning && (
                <p className="storage-warning">
                  {t(
                    'このブラウザでは途中の記録を保存できません。ページを閉じるとリセットされます。',
                  )}
                </p>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
      <footer>
        <span>
          {mode === 'daily' ? t('一日一語。') : t('練習は何度でも。')}
        </span>
        <button className="text-button" onClick={() => setHelp(true)}>
          {t('遊び方・出典')}
        </button>
      </footer>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog" showCloseButton={false}>
          <DialogClose
            className="icon-button dialog-close"
            aria-label={t('閉じる')}
          >
            <X size={20} />
          </DialogClose>
          <DialogTitle className="help-title">{t('遊び方')}</DialogTitle>
          <DialogDescription className="help-intro">
            {t(
              'ひらがなの言葉を、8回以内に当てるパズルです。今日の一問は4文字。練習は3〜6文字から選べます。',
            )}
          </DialogDescription>
          <div className="help-body">
            <div className="example">
              <span className="tile correct">
                が<small>✓</small>
              </span>
              <span className="tile present">
                っ<small>●</small>
              </span>
              <span className="tile absent">
                こ<small>−</small>
              </span>
              <span className="tile absent">
                う<small>−</small>
              </span>
            </div>
            <dl className="help-legend">
              <div>
                <dt>{t('青・✓')}</dt>
                <dd>{t('文字も位置も一致。')}</dd>
              </div>
              <div>
                <dt>{t('黄・●')}</dt>
                <dd>{t('その文字は、別の位置にある。')}</dd>
              </div>
              <div>
                <dt>{t('灰・−')}</dt>
                <dd>{t('その文字は含まれない。')}</dd>
              </div>
            </dl>
            <h3>{t('ヒント表示')}</h3>
            <p>
              {t(
                '設定でオンにすると、濁点・半濁点・大小だけが違うかなを枠線で示します。青い枠と✓は同じ位置、黄色い枠と●は別の位置。「き」に対して「ぎ」、「つ」に対して「っ」や「づ」などです。モードは各問題の最初の回答で決まります。',
              )}
            </p>
            <h3>{t('ハードモード')}</h3>
            <p>
              {t(
                '設定でオンにすると、それまでのヒントと矛盾しない、答えになりうる言葉だけ回答できます。✓のかなは同じ位置、●のかなは別の位置で使い、−のかなは使えません。ヒント表示もオンなら、枠線のヒントにも従います。モードは各問題の最初の回答で決まります。',
              )}
            </p>
            <h3>{t('かなの数え方')}</h3>
            <p>
              {t(
                '「がっこう」は「が・っ・こ・う」の4文字。「きゃ」は2文字です。濁点・半濁点は前のかなと一体。「か」と「が」、「つ」と「っ」は別の文字です。「ー」も1文字に数えます。',
              )}
            </p>
            <h3>{t('入力のコツ')}</h3>
            <p>
              {t(
                'ローマ字は入力中にひらがなへ変換されます。途中の子音は次の文字を待ち、最後の「ん」は回答時に確定します。カタカナも使えます。漢字は読みが一つに決まれば変換できます。日本語入力の確定後、もう一度 Enter で回答します。',
              )}
            </p>
            <p>
              {t(
                '下の「゛ / ゜」「大 ↔ 小」は最後のかなを切り替えます。「濁音・小文字」から直接選ぶこともできます。',
              )}
            </p>
            <h3>{t('使える言葉')}</h3>
            <p>
              {t(
                '名詞・動詞・形容詞・副詞・外来語など。動詞や形容詞は辞書形で入力してください。同じ文字を複数入れた場合、答えにある個数だけ色がつきます。位置が一致する文字から判定します。',
              )}
            </p>
            <h3>{t('今日の一問と練習')}</h3>
            <p>
              {t(
                '毎日、この端末の時刻で0時に更新。同じ日付なら同じ問題です。練習は何度でも遊べます。途中の記録はこのブラウザに保存され、端末間では共有されません。',
              )}
            </p>
            <div className="credits">
              <p>
                {t('辞書：')}
                <a
                  href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project"
                  target="_blank"
                  rel="noreferrer"
                >
                  JMdict / EDICT
                </a>
                {t('（© EDRDG）。3〜6文字の読みに抽出・変換。')}
                <a
                  href="https://www.edrdg.org/edrdg/licence.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('CC BY-SA 4.0・利用条件')}
                </a>
                {t('。更新：')}
                {dictionaryUpdated}
                {t('。')}
              </p>
              <p>
                {t('正解の言葉は日常語から選定。判定用辞書は')}
                {valid.size.toLocaleString('ja-JP')}
                {t('語。')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={givingUp} onOpenChange={setGivingUp}>
        <AlertDialogContent
          className="help-dialog confirm-dialog"
          initialFocus={continueButton}
        >
          <AlertDialogTitle className="help-title">
            {t('ここで終了しますか？')}
          </AlertDialogTitle>
          <AlertDialogDescription className="help-intro">
            {mode === 'daily'
              ? t(
                  '答えを表示し、今日の一問を不正解として記録します。今日はやり直せません。',
                )
              : t(
                  '答えを表示して、この練習を終了します。次の問題はすぐに遊べます。',
                )}
          </AlertDialogDescription>
          <div className="dialog-actions">
            <button className="primary-button danger-button" onClick={giveUp}>
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
    </main>
  );
}
