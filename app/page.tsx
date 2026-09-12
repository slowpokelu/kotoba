'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state and event handlers manage IME timing. */
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points, including small kana. */
/* oxlint-disable typescript/no-deprecated -- keyCode 229 covers Safari IME confirmation, where isComposing can be false. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  Delete,
  ArrowRight,
  Copy,
  RotateCcw,
  Keyboard,
  X,
  ExternalLink,
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
import { convertInput, convertRomaji, previewKana } from '@/lib/kana-input.mjs';
import { PlayerTools } from './player-tools';
import { LanguageProvider, useLanguage } from './language';
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
  normalize,
  resolveGuess,
  evaluate,
  keyboardStates,
  dailyAnswer,
  localDay,
  validateGuess,
  newGame,
  restoreGame,
  outcome,
  modifyLast,
  shareText,
  labels,
  marks,
} from '@/lib/game.mjs';

type Game = {
  version: number;
  id: string;
  answer: string;
  guesses: string[];
  draft: string;
  gaveUp?: boolean;
};
type Mode = 'daily' | 'practice';
type Status = 'correct' | 'present' | 'absent';
const rows = [
  'あかさたなはまやらわ',
  'いきしちにひみ　りを',
  'うくすつぬふむゆるん',
  'えけせてねへめ　れー',
  'おこそとのほもよろ　',
];
const alternateRows = [
  'がざだばぱぁゃっゔ　',
  'ぎじぢびぴぃ　　　　',
  'ぐずづぶぷぅゅ　　　',
  'げぜでべぺぇ　　　　',
  'ごぞどぼぽぉょゎ　　',
];
const storageKey = (id: string) => 'kotoba:v1:' + id;
function loadGame(fallback: Game) {
  try {
    return restoreGame(
      localStorage.getItem(storageKey(fallback.id)),
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
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceLength, setPracticeLength] = useState(4);
  const [day, setDay] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [help, setHelp] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [extra, setExtra] = useState(false);
  const [revealing, setRevealing] = useState(-1);
  const [copyFallback, setCopyFallback] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const composing = useRef(false);
  const compositionEnd = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useLayoutEffect(() => {
    if (selection.current && !composing.current) {
      field.current?.setSelectionRange(
        selection.current.start,
        selection.current.end,
      );
    }
    selection.current = null;
  }, [game]);
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
      localStorage.setItem(storageKey(game.id), JSON.stringify(game));
    } catch {
      setStorageWarning(true);
    }
  }, [game]);

  const result = game ? outcome(game) : 'playing';
  const length = mode === 'daily' ? 4 : practiceLength;
  const aliases = aliasesFor(length);
  const finished = result !== 'playing';
  const keys = (
    game ? keyboardStates(game.guesses, game.answer) : {}
  ) as Record<string, Status>;
  const draft = game ? resolveGuess(game.draft, aliases) : '';
  const tiles = [...previewKana(draft)].slice(0, length);
  const answer = game
    ? allAnswers.find((a) => a.reading === game.answer)
    : null;

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function edit(value: string) {
    const current = gameRef.current;
    if (!current || outcome(current) !== 'playing' || busy.current) return;
    const next = { ...current, draft: value.slice(0, 40) };
    gameRef.current = next;
    setGame(next);
    say('');
  }
  function typeInput(input: HTMLInputElement) {
    const next = convertInput(
      input.value,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
    );
    selection.current = next;
    edit(next.value);
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
    try {
      localStorage.setItem(PRACTICE_LENGTH_KEY, String(next));
    } catch {
      setStorageWarning(true);
    }
  }
  function giveUp() {
    const current = gameRef.current;
    if (!current || busy.current || outcome(current) !== 'playing') return;
    const next = { ...current, gaveUp: true, draft: '' };
    gameRef.current = next;
    setGame(next);
    setGivingUp(false);
    say('答えは「' + next.answer + '」でした。');
  }
  function insert(k: string) {
    if (!game || finished || busy.current) return;
    const input = field.current;
    // Respect a selected range or caret when using the on-screen keys.
    const start = input?.selectionStart ?? game.draft.length,
      end = input?.selectionEnd ?? start;
    const next = convertInput(
      game.draft.slice(0, start) + k + game.draft.slice(end),
      start + k.length,
    );
    if ([...normalize(next.value)].length > length) {
      say(`${length}文字まで入力できます。`, true);
      return;
    }
    selection.current = next;
    edit(next.value);
  }
  function backspace() {
    if (!game) return;
    const start = field.current?.selectionStart ?? game.draft.length,
      end = field.current?.selectionEnd ?? start;
    const caret = start === end ? Math.max(0, start - 1) : start;
    selection.current = { start: caret, end: caret };
    if (start === end)
      edit(game.draft.slice(0, Math.max(0, start - 1)) + game.draft.slice(end));
    else edit(game.draft.slice(0, start) + game.draft.slice(end));
  }
  function submit() {
    const current = gameRef.current;
    if (
      !current ||
      outcome(current) !== 'playing' ||
      busy.current ||
      composing.current ||
      Date.now() - compositionEnd.current < 150
    )
      return;
    // Keep keyboard entry continuous, including after clicking the submit button.
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
    busy.current = true;
    const next = {
      ...current,
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
        say('正解！ ' + next.guesses.length + '回で見つけました。');
      else if (state === 'lost') say('答えは「' + next.answer + '」でした。');
      else
        say(
          guess +
            '：' +
            evaluate(guess, next.answer)
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
            .replace(/(\d)文字/, '$1 kana')
        : shareText(game, day);
    try {
      await navigator.clipboard.writeText(text);
      say('結果をコピーしました。');
    } catch {
      setCopyFallback(text);
      say('下の結果を選択してコピーできます。');
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1>
          ことば
          <span className="seal" aria-hidden="true">
            四
          </span>
        </h1>
        <div className="header-actions">
          <span className="subtitle">{t('かなのパズル')}</span>
          <PlayerTools
            game={game}
            day={day}
            busy={revealing >= 0}
            practiceLength={practiceLength}
            onImport={() => {
              if (!game || busy.current) return;
              const nextLength = savedPracticeLength(localStorage);
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
                        <label className="length-choice" key={n}>
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
                    guess && game ? evaluate(guess, game.answer) : [];
                  const active =
                    !!game && !finished && r === game.guesses.length;
                  const letters = guess ? [...guess] : active ? tiles : [];
                  return (
                    <div
                      className={
                        'guess-row ' + (revealing === r ? 'reveal' : '')
                      }
                      key={r}
                      aria-label={t(
                        guess
                          ? '第' + (r + 1) + '回答：' + guess
                          : '第' + (r + 1) + '回答',
                      )}
                    >
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
                    </div>
                  );
                })}
              </div>
              <div className="legend" aria-label={t('色と記号の意味')}>
                <span>
                  <i className="correct">✓</i>
                  {t('位置も一致')}
                </span>
                <span>
                  <i className="present">●</i>
                  {t('別の位置')}
                </span>
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
                    <button className="primary-button" onClick={again}>
                      <RotateCcw size={17} />
                      {t('もう一問')}
                    </button>
                    <button className="secondary-button" onClick={copy}>
                      <Copy size={17} />
                      {t('結果をコピー')}
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
                  {mode === 'daily' && (
                    <p className="next-day">
                      {t('次の一問は、この端末の時刻で0時に。')}
                    </p>
                  )}
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
                      ref={field}
                      lang="ja"
                      value={game?.draft || ''}
                      disabled={!game || finished}
                      readOnly={revealing >= 0}
                      placeholder={t('ここに入力')}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-describedby="game-message"
                      aria-invalid={error || undefined}
                      onChange={(e) => {
                        if (
                          composing.current ||
                          (e.nativeEvent as InputEvent).isComposing ||
                          Date.now() - compositionEnd.current < 150
                        )
                          edit(e.currentTarget.value);
                        else typeInput(e.currentTarget);
                      }}
                      onCompositionStart={() => {
                        selection.current = null;
                        composing.current = true;
                      }}
                      onCompositionEnd={(e) => {
                        composing.current = false;
                        compositionEnd.current = Date.now();
                        edit(normalize(e.currentTarget.value));
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          (e.nativeEvent.isComposing ||
                            composing.current ||
                            e.keyCode === 229 ||
                            Date.now() - compositionEnd.current < 150)
                        )
                          e.preventDefault();
                      }}
                      onBlur={() => {
                        if (
                          game &&
                          !composing.current &&
                          game.draft !==
                            normalize(convertRomaji(game.draft, true))
                        )
                          edit(normalize(convertRomaji(game.draft, true)));
                      }}
                    />
                    <button
                      type="submit"
                      className="primary-button submit-button"
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
                {error || finished ? (
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
              <div
                className={'keyboard-section ' + (finished ? 'finished' : '')}
              >
                <div className="keyboard-heading">
                  <span>
                    <Keyboard size={16} />
                    {t('かな入力')}
                  </span>
                  <button
                    className="text-button"
                    aria-pressed={extra}
                    onClick={() => setExtra(!extra)}
                  >
                    {extra ? t('五十音に戻す') : t('濁音・小文字')}
                  </button>
                </div>
                <div
                  className="keyboard"
                  aria-label={
                    extra
                      ? t('濁音と小文字のキーボード')
                      : t('五十音キーボード')
                  }
                >
                  {(extra ? alternateRows : rows).flatMap((row, r) =>
                    [...row].map((k, c) =>
                      k === '　' ? (
                        <span className="key-gap" key={r + '-' + c} />
                      ) : (
                        <button
                          type="button"
                          key={r + '-' + c}
                          className={'kana-key ' + (keys[k] || '')}
                          disabled={!game || finished || revealing >= 0}
                          aria-label={
                            k + (keys[k] ? '、' + t(labels[keys[k]]) : '')
                          }
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => insert(k)}
                        >
                          {k}
                          {keys[k] && (
                            <small aria-hidden="true">{marks[keys[k]]}</small>
                          )}
                        </button>
                      ),
                    ),
                  )}
                </div>
                <div className="keyboard-tools">
                  <button
                    disabled={!game || finished || revealing >= 0}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => edit(modifyLast(game?.draft || '', 'voice'))}
                    aria-label={t('最後のかなの濁点・半濁点を切り替え')}
                  >
                    ゛<span> / </span>゜
                  </button>
                  <button
                    disabled={!game || finished || revealing >= 0}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => edit(modifyLast(game?.draft || '', 'small'))}
                  >
                    {t('大 ↔ 小')}
                  </button>
                  <button
                    className="erase-key"
                    disabled={!game || finished || revealing >= 0}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={backspace}
                    aria-label={t('1文字消す')}
                  >
                    <Delete size={19} />
                    {t('消す')}
                  </button>
                </div>
              </div>
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
        <AlertDialogContent className="help-dialog confirm-dialog">
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
            <AlertDialogCancel className="secondary-button">
              {t('続ける')}
            </AlertDialogCancel>
            <button className="primary-button danger-button" onClick={giveUp}>
              {t('終了して答えを見る')}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
