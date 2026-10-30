'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; mount effects restore browser state. */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
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
  SHIRITORI_KEY,
  SHIRITORI_BEST_KEY,
  SHIRITORI_DUO_KEY,
  SHIRITORI_MODE_KEY,
  duoTurn,
  checkWord,
  cpuWord,
  losesOnN,
  newShiritori,
  restoreShiritori,
  shiritoriShare,
  tailKana,
  yourWords,
} from '@/lib/shiritori.mjs';
import {
  allAnswers,
  allValid,
  aliasesFor,
  commonWords,
  wordValid as valid,
} from '@/lib/word-pools.mjs';
import { KanaKeyboard, useKanaField } from './kana-input';
import { useLanguage } from './language';
import { SHIRITORI_PLAYED_KEY, countPlay } from '@/lib/stats.mjs';
import { ShareButton, englishShare, jisho, useFinePointer } from './share';

type Link = { word: string; by: 'cpu' | 'you' | 'p1' | 'p2' };
type Round = {
  version: number;
  chain: Link[];
  end: null | 'n' | 'gave-up' | 'cpu';
  draft: string;
};

const everyday = allAnswers.map((a) => a.reading);
const common = Object.keys(commonWords);
// Spellings to show: the curated answers first, then the common words.
const spelling = new Map<string, string>([
  ...Object.entries(commonWords as Record<string, string>),
  ...allAnswers.map((a) => [a.reading, a.spelling] as [string, string]),
]);
// Kanji typed through an IME resolve to their reading, as in the main game.
const aliases: Record<string, string> = Object.assign(
  Object.fromEntries([...spelling].map(([reading, kanji]) => [kanji, reading])),
  ...[3, 4, 5, 6].map(aliasesFor),
);
let dictionary: string[] | null = null;
// The computer reaches for everyday words, then common ones, then anything.
const pools = () => [everyday, common, (dictionary ??= [...allValid])];
const opening = () =>
  newShiritori(cpuWord(null, [], [everyday]) ?? everyday[0]) as Round;

export function Shiritori({
  onTyping,
}: {
  onTyping: (typing: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const finePointer = useFinePointer();
  const [round, setRound] = useState<Round | null>(null);
  const [best, setBest] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [record, setRecord] = useState(false);
  // ふたり: two players share the device; null until the choice is read.
  const [duo, setDuo] = useState<boolean | null>(null);
  const key = duo ? SHIRITORI_DUO_KEY : SHIRITORI_KEY;
  const list = useRef<HTMLOListElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setDuo(localStorage.getItem(SHIRITORI_MODE_KEY) === 'duo');
      setBest(Number(localStorage.getItem(SHIRITORI_BEST_KEY)) || 0);
    } catch {
      setDuo(false);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // Each mode keeps its own round.
  useEffect(() => {
    if (duo === null) return;
    let saved: Round | null = null;
    try {
      saved = restoreShiritori(localStorage.getItem(key), valid);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    setRound(saved ?? opening());
    setRecord(false);
    setMessage('');
  }, [duo, key]);
  useEffect(() => {
    if (!round || duo === null) return;
    try {
      localStorage.setItem(key, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round, key, duo]);
  function chooseMode(next: boolean) {
    if (next === duo || thinking) return;
    setRound(null);
    setDuo(next);
    try {
      localStorage.setItem(SHIRITORI_MODE_KEY, next ? 'duo' : 'cpu');
    } catch {
      /* The choice lasts for this visit. */
    }
  }
  // Keep the newest word in view, also when the chain changes size (the phone
  // keyboard opening or closing).
  const words = round?.chain.length ?? 0;
  useEffect(() => {
    const chain = list.current;
    if (!chain) return;
    const toNewest = () => (chain.scrollTop = chain.scrollHeight);
    toNewest();
    const observer = new ResizeObserver(toNewest);
    observer.observe(chain);
    return () => observer.disconnect();
  }, [words, thinking]);

  const playing = !!round && !round.end;
  const kana = useKanaField(round?.draft ?? '', (draft) =>
    setRound((r) => (r && !r.end ? { ...r, draft: draft.slice(0, 40) } : r)),
  );
  const need = round ? tailKana(round.chain.at(-1)!.word) : '';

  function say(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function finish(next: Round) {
    if (duo) {
      setRound(next);
      return;
    }
    countPlay(localStorage, SHIRITORI_PLAYED_KEY);
    const score = yourWords(next);
    if (score > best) {
      setBest(score);
      setRecord(true);
      try {
        localStorage.setItem(SHIRITORI_BEST_KEY, String(score));
      } catch {
        /* The record shows for this session. */
      }
    }
    setRound(next);
  }
  function submit() {
    if (!round || !playing || thinking || kana.composingNow()) return;
    const word = resolveGuess(convertRomaji(round.draft, true), aliases);
    const checked = checkWord(word, round.chain, valid);
    if (checked.error) {
      say(checked.error, true);
      return;
    }
    const by = duo ? duoTurn(round) : 'you';
    const chain: Link[] = [...round.chain, { word, by }];
    if (losesOnN(word)) {
      say(
        duo
          ? `「ん」で終わったので、${by === 'p1' ? '先手' : '後手'}の負けです。`
          : '「ん」で終わったので、あなたの負けです。',
      );
      finish({ ...round, chain, draft: '', end: 'n' });
      return;
    }
    say('');
    setRound({ ...round, chain, draft: '' });
    if (duo) return;
    setThinking(true);
    // A short pause so the reply reads as a turn, not an echo.
    timer.current = setTimeout(() => {
      setThinking(false);
      const reply = cpuWord(tailKana(word), chain, pools());
      if (!reply) {
        say(
          `「${tailKana(word)}」から始まる言葉が見つかりません。あなたの勝ち！`,
        );
        finish({ ...round, chain, draft: '', end: 'cpu' });
        return;
      }
      setRound({
        ...round,
        chain: [...chain, { word: reply, by: 'cpu' }],
        draft: '',
      });
    }, 450);
  }
  function restart() {
    if (timer.current) clearTimeout(timer.current);
    setThinking(false);
    setRecord(false);
    say('');
    setRound(opening());
  }

  const score = round ? (duo ? round.chain.length - 1 : yourWords(round)) : 0;
  const turn = round && duo ? duoTurn(round) : 'you';
  const name = (by: string) => (by === 'p1' ? '先手' : '後手');
  // Who lost: the one who said ん, or the one whose turn it was to answer.
  const loser =
    round?.end === 'n' ? round.chain.at(-1)!.by : round?.end ? turn : '';
  return (
    <section className="play-area shiritori" aria-label={t('しりとり')}>
      <div className="board-column">
        <div className="game-heading">
          <fieldset className="shiritori-mode">
            <legend className="sr-only">{t('相手')}</legend>
            {[false, true].map((two) => (
              <button
                key={String(two)}
                type="button"
                aria-pressed={duo === two}
                disabled={thinking}
                onClick={() => chooseMode(two)}
              >
                {two ? t('ふたり') : t('コンピューター')}
              </button>
            ))}
          </fieldset>
          <span>
            {t(score + '語')}
            {!duo && ' · ' + t('最高 ' + best)}
          </span>
        </div>
        <ol className="chain" ref={list} aria-label={t('しりとりの言葉')}>
          {round?.chain.map((link, i) => {
            const word = (
              <>
                <b lang="ja">{spelling.get(link.word) ?? link.word}</b>
                {spelling.has(link.word) &&
                  spelling.get(link.word) !== link.word && (
                    <small lang="ja">{link.word}</small>
                  )}
              </>
            );
            return (
              <li
                key={i}
                className={
                  'chain-word ' +
                  (link.by === 'you' || link.by === 'p1' ? 'you' : 'cpu') +
                  (duo && !i ? ' opener' : '')
                }
              >
                <span className="sr-only">
                  {duo
                    ? i
                      ? t(name(link.by) + '：')
                      : t('お題：')
                    : link.by === 'you'
                      ? t('あなた：')
                      : t('相手：')}
                </span>
                {/* As on the boards: a mouse looks words up mid-game, touch
                    once the chain is over. */}
                {round.end || finePointer ? (
                  <a
                    href={jisho(spelling.get(link.word) ?? link.word)}
                    target="_blank"
                    rel="noreferrer"
                    title={t('辞書で見る')}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {word}
                  </a>
                ) : (
                  word
                )}
              </li>
            );
          })}
          {playing && round.chain.length === 1 && (
            <li className="chain-hint">
              {duo
                ? t(
                    'お題から、先手と後手が交互に続けます。「ん」で終わるか、降参したら負け。',
                  )
                : t(
                    '相手の言葉の最後のかなから始まる言葉を答えよう。「ん」で終わったら負け。',
                  )}
            </li>
          )}
          {thinking && (
            <li className="chain-word cpu thinking" aria-hidden="true">
              <b>…</b>
            </li>
          )}
        </ol>
      </div>
      <div className="control-column">
        {round?.end ? (
          <section className="result-card" aria-label={t('結果')}>
            <span className="eyebrow">
              {duo
                ? t(name(loser === 'p1' ? 'p2' : 'p1') + 'の勝ち')
                : round.end === 'cpu'
                  ? t('あなたの勝ち')
                  : t('おしまい')}
            </span>
            <h2>{t(score + '語')}</h2>
            <p>
              {duo
                ? t(score + '語つながりました。')
                : record
                  ? t('最高記録！')
                  : t('最高 ' + best)}
            </p>
            <div className="result-actions">
              <button className="primary-button" onClick={restart}>
                <RotateCcw size={17} />
                {t('もう一度')}
              </button>
              <ShareButton
                text={
                  language === 'en'
                    ? englishShare(shiritoriShare(round))
                    : shiritoriShare(round)
                }
              />
            </div>
          </section>
        ) : (
          <>
            <p className="next-kana">
              <span>
                {duo && <em className="turn">{t(name(turn))}</em>}
                {t('次は')}
                <b lang="ja">「{need}」</b>
                {t('から')}
              </span>
              <small>{t('2文字以上・「ん」で終わると負け')}</small>
            </p>
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
                readOnly={thinking}
                placeholder={t('ここに入力')}
                aria-label={t('「' + need + '」から始まる言葉')}
                aria-describedby="shiritori-message"
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
                disabled={!playing || thinking || !round?.draft.trim()}
                aria-label={t('回答する')}
              >
                {t('決定')}
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button give-up"
              onPointerDown={(e) => e.preventDefault()}
              disabled={!playing || thinking}
              onClick={() => setGivingUp(true)}
            >
              {t('降参する')}
            </button>
          </>
        )}
        <output
          id="shiritori-message"
          aria-live="polite"
          className={'status ' + (error ? 'error' : '')}
        >
          {error || round?.end ? t(message) : null}
        </output>
        <KanaKeyboard
          disabled={!playing || thinking}
          finished={!playing}
          onInsert={(k) => {
            if (!kana.insert(k, 12)) say('12文字まで入力できます。', true);
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
            {t('降参しますか？')}
          </AlertDialogTitle>
          <AlertDialogDescription className="help-intro">
            {t('ここでしりとりを終えて、記録を確定します。')}
          </AlertDialogDescription>
          <div className="dialog-actions">
            <button
              className="primary-button danger-button"
              onClick={() => {
                setGivingUp(false);
                if (round) {
                  say(duo ? name(turn) + 'が降参しました。' : '降参しました。');
                  finish({ ...round, draft: '', end: 'gave-up' });
                }
              }}
            >
              {t('降参する')}
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
