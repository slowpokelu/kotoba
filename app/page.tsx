'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state and event handlers manage IME timing. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points, including small kana. */

import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  ArrowRight,
  RotateCcw,
  X,
  ExternalLink,
} from 'lucide-react';
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
import { Shiritori } from './shiritori';
import { Double } from './double';
import { Legend, ModeChips } from './legend';
import { NextPuzzle } from './next-puzzle';
import { GameNav, gameLabel, type Route } from './game-menu';
import { parseRoute, routePath } from '@/lib/routes.mjs';
import { Bee } from './bee';
import { ShareButton, englishShare, jisho, useFinePointer } from './share';
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
  limitFor,
  dodge,
  ABSURD_BEST_KEY,
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

type Mode = 'daily' | 'practice' | 'play';
const modeOf = (route: Route): Mode =>
  route.game === 'kotoba' ? (route.practice ? 'practice' : 'daily') : 'play';
// The address picks the game; the server sends the same page for each.
function routeHere(): Route & { base: string } {
  if (typeof window === 'undefined')
    return { game: 'kotoba', practice: false, base: '/' };
  return parseRoute(window.location.pathname) as Route & { base: string };
}
// いじわる picks from the everyday four-kana words.
const absurdPool = answersFor(4).map((a) => a.reading);
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

export default function Home() {
  return (
    <LanguageProvider>
      <GameView />
    </LanguageProvider>
  );
}
function GameView() {
  const { t, language } = useLanguage();
  const [route, setRoute] = useState<Route>(() => {
    const { game, practice } = routeHere();
    return { game, practice };
  });
  const base = useRef(routeHere().base);
  const mode = modeOf(route);
  const playMode = route.game;
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
  const [storageWarning, setStorageWarning] = useState(false);
  // Finish announcements are for screen readers; the result card shows them.
  const [quiet, setQuiet] = useState(false);
  // Bumped on every refused guess to replay the row's shake.
  const [shake, setShake] = useState(0);
  // The winning row hops once, right after its reveal.
  const [celebrate, setCelebrate] = useState(false);
  const againButton = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  const kana = useKanaField(game?.draft || '', edit);
  const field = kana.field;
  const finePointer = useFinePointer();
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
  // On a computer, typing anywhere goes into the field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const input = document.getElementById('guess') as HTMLInputElement;
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
  }, []);
  const currentDay = useRef('');
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const today = localDay();
    let length = 4;
    currentDay.current = today;
    setDay(today);
    try {
      length = savedPracticeLength(localStorage);
      setPracticeLength(length);
      setHintSetting(localStorage.getItem(HINTS_KEY) === '1');
      setHardSetting(localStorage.getItem(HARD_KEY) === '1');
    } catch {
      /* Use four kana if browser storage is unavailable. */
    }
    setGame(gameFor(modeRef.current, length));
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
  const length = mode === 'practice' ? practiceLength : 4;
  const limit = game ? limitFor(game.id) : LIMIT;
  const absurd = game?.id === 'absurd';
  const turn = game ? game.guesses.length + (result === 'playing' ? 1 : 0) : 1;
  // いじわる adds rows as needed beyond the usual eight, and scrolls to them.
  const rows = absurd ? Math.max(LIMIT, turn) : limit;
  const shiritori = mode === 'play' && playMode === 'shiritori';
  const double =
    mode === 'play' && (playMode === 'double' || playMode === 'triple');
  const bee = mode === 'play' && playMode === 'bee';
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
  // Keep the current row in view on a scrolling board, also when the board
  // changes size (the phone keyboard opening or closing).
  useEffect(() => {
    const board = boardRef.current;
    if (!board?.dataset.scroll) return;
    const toCurrent = () => (board.scrollTop = board.scrollHeight);
    toCurrent();
    const observer = new ResizeObserver(toCurrent);
    observer.observe(board);
    return () => observer.disconnect();
  }, [game?.guesses.length, rows]);
  useEffect(() => setCelebrate(false), [game?.id, game?.answer]);
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
  // The game a tab opens: today's puzzle, the saved practice round, or いじわる.
  function gameFor(next: Mode, length = practiceLength) {
    if (next === 'daily')
      return loadGame(
        newGame(
          dailyAnswer(currentDay.current, answers).reading,
          'daily:' + currentDay.current,
        ),
      );
    if (next === 'practice')
      return loadGame(newGame(pickPractice(length), practiceId(length)));
    return loadGame(newGame(pickPractice(4), 'absurd'));
  }
  // Opens a game at its address. Back and forward come through show().
  function go(next: Route) {
    if (busy.current) return;
    try {
      window.history.pushState(
        null,
        '',
        routePath(base.current, next.game, next.practice),
      );
    } catch {
      /* The game still switches without an address. */
    }
    show(next);
  }
  function show(next: Route, length = practiceLength) {
    if (timer.current) clearTimeout(timer.current);
    busy.current = false;
    setRoute(next);
    setGame(gameFor(modeOf(next), length));
    setGivingUp(false);
    setRevealing(-1);
    say('');
  }
  // Tabs and bookmarks name the game.
  useEffect(() => {
    document.title =
      route.game === 'kotoba'
        ? 'ことば · Kotoba'
        : gameLabel(route.game) + ' · ことば';
  }, [route.game]);
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });
  useEffect(() => {
    const back = () => {
      const { game, practice } = routeHere();
      showRef.current({ game, practice });
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  function again() {
    if (busy.current) return;
    setGame(
      absurd
        ? newGame(pickPractice(4, game?.answer), 'absurd')
        : newGame(
            pickPractice(practiceLength, game?.answer),
            practiceId(practiceLength),
          ),
    );
    if (!absurd && mode !== 'practice') {
      try {
        window.history.pushState(
          null,
          '',
          routePath(base.current, 'kotoba', true),
        );
      } catch {
        /* The round still starts without an address. */
      }
      setRoute({ game: 'kotoba', practice: true });
    }
    say('');
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
    // A round takes its modes at the first guess; いじわる then dodges.
    const round = {
      ...current,
      ...(current.guesses.length === 0 && hintSetting ? { hints: true } : {}),
      ...(current.guesses.length === 0 && hardSetting ? { hard: true } : {}),
    };
    const next = {
      ...round,
      answer: absurd ? dodge(round, guess, absurdPool) : round.answer,
      guesses: [...round.guesses, guess],
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
      if (state === 'won') {
        say(
          '正解！ ' + next.guesses.length + '回で見つけました。',
          false,
          true,
        );
        setCelebrate(true);
        if (next.id === 'absurd')
          try {
            const best = Number(localStorage.getItem(ABSURD_BEST_KEY)) || 0;
            if (!best || next.guesses.length < best)
              localStorage.setItem(
                ABSURD_BEST_KEY,
                String(next.guesses.length),
              );
          } catch {
            /* The best stays unsaved. */
          }
      } else if (state === 'lost')
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
            game={shiritori || double || bee ? null : game}
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
      <div className="game-tabs">
        <GameNav
          route={route}
          base={base.current}
          day={day}
          disabled={revealing >= 0}
          onGo={go}
        />
        <div className="game-panel">
          {shiritori ? (
            <Shiritori onTyping={setTyping} />
          ) : bee ? (
            <Bee onTyping={setTyping} day={day} />
          ) : double ? (
            <Double
              // A fresh component per round, so each keeps its own state.
              key={playMode + (route.practice ? ':practice' : ':' + day)}
              boards={playMode === 'triple' ? 3 : 2}
              day={route.practice ? '' : day}
              onPractice={() => go({ ...route, practice: true })}
              onTyping={setTyping}
              hintSetting={hintSetting}
            />
          ) : (
            <section
              className="play-area"
              aria-label={
                mode === 'daily'
                  ? t('今日の一問')
                  : mode === 'practice'
                    ? t('練習')
                    : t('いじわる')
              }
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
                  ) : mode === 'play' ? (
                    <span />
                  ) : (
                    <h2>
                      {day ? day.replaceAll('-', ' / ') : t('今日の一問')}
                    </h2>
                  )}
                  <span className="game-count">
                    <ModeChips hard={showHard} hints={showHints} />
                    {absurd
                      ? t(turn + '手目')
                      : `${Math.min(turn, limit)} / ${limit}`}
                  </span>
                </div>
                <div
                  className="board"
                  ref={boardRef}
                  data-length={length}
                  data-scroll={rows > LIMIT || undefined}
                  aria-label={absurd ? t('解答欄') : t(limit + '回の解答欄')}
                  aria-busy={revealing >= 0}
                >
                  {Array.from({ length: rows }, (_, r) => {
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
                        ? jisho(
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
                                <small aria-hidden="true">
                                  {marks[status]}
                                </small>
                              )}
                            </span>
                          );
                        })}
                      </>
                    );
                    const className =
                      'guess-row' +
                      (revealing === r ? ' reveal' : '') +
                      (active && error && shake ? ' shake' : '') +
                      (celebrate && guess === game?.answer ? ' won' : '');
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
                <Legend hints={showHints} />
              </div>
              <div className="control-column">
                {finished && revealing < 0 ? (
                  <section className="result-card" aria-label={t('結果')}>
                    <span className="eyebrow">
                      {absurd
                        ? result === 'won'
                          ? t('追い詰めた！')
                          : t('逃げ切られた')
                        : result === 'won'
                          ? t('正解')
                          : t('今回の答え')}
                    </span>
                    <h2>{answer?.spelling}</h2>
                    <p className="answer-reading">{game?.answer}</p>
                    {result === 'won' && (
                      <p>
                        {absurd
                          ? t(game?.guesses.length + '手で追い詰めました。')
                          : t(
                              game?.guesses.length +
                                ' / ' +
                                limit +
                                ' 回で正解。',
                            )}
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
                      {game && (
                        <ShareButton
                          text={
                            language === 'en'
                              ? englishShare(shareText(game, day))
                              : shareText(game, day)
                          }
                        />
                      )}
                    </div>
                    <a
                      className="dictionary-link"
                      href={jisho(answer?.spelling || '')}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('辞書で見る')}
                      <ExternalLink size={14} />
                    </a>
                    {mode === 'daily' && <NextPuzzle />}
                  </section>
                ) : (
                  <>
                    <div className="input-heading">
                      <label htmlFor="guess">
                        {t(`ひらがな${length}文字`)}
                      </label>
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
          )}
        </div>
      </div>
      <footer>
        <span>
          {mode === 'daily'
            ? t('一日一語。')
            : route.practice ||
                route.game === 'absurd' ||
                route.game === 'shiritori'
              ? t('何度でも遊べます。')
              : t('毎日0時に新しい問題。')}
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
                '設定でオンにすると、濁点・半濁点・大小だけが違うかなを枠線で示します。青い枠と✓は同じ位置、黄色い枠と●は別の位置。「き」に対して「ぎ」、「つ」に対して「っ」や「づ」などです。モードは各問題の最初の回答で決まり、回数の横に表示されます。',
              )}
            </p>
            <h3>{t('ハードモード')}</h3>
            <p>
              {t(
                '設定でオンにすると、それまでのヒントと矛盾しない、答えになりうる言葉だけ回答できます。✓のかなは同じ位置、●のかなは別の位置で使い、−のかなは使えません。ヒント表示もオンなら、枠線のヒントにも従います。モードは各問題の最初の回答で決まり、回数の横に表示されます。',
              )}
            </p>
            <h3>{t('ほかのゲーム')}</h3>
            <p>
              {t(
                'かなビー：7つのかなで、よく使う言葉をできるだけ多く作ります。真ん中のかなは必ず使い、3文字以上。小さいかなは大きいかなで数え（しゃ→し・や）、「ー」はいつでも使えます。3文字は1点、それより長い言葉は文字数が点数、7つ全部を使うと7点追加。毎日0時に新しい問題になります。',
              )}
            </p>
            <p>
              {t(
                'ダブル：2つの言葉を同時に当てます。回答は両方の盤面に入り、9回以内に両方を当てれば正解。キーは左右で、それぞれの盤面の結果を示します。トリプルは3つの言葉を10回以内に。どちらにも全員共通の今日の一問と練習があり、ハードモードは使いません。',
              )}
            </p>
            <p>
              {t(
                'いじわる：回答するたびに、それまでの結果と矛盾しない別の言葉へ答えが逃げていく4文字のパズル。回数制限はなし。何手で追い詰められるか挑戦します。',
              )}
            </p>
            <p>
              {t(
                'しりとり：前の言葉の最後のかなから始まる、2文字以上の言葉で続けます。小さいかなは大きく（しゃ→や）、最後の「ー」は一つ前のかなで続けます。「ん」で終わると負け。同じ言葉は使えません。時間制限はありません。',
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
                {t(
                  '（© EDRDG）。3〜6文字の読みと、よく使う言葉（2〜8文字）に抽出・変換。',
                )}
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
