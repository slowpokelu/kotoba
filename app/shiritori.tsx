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
  checkWord,
  cpuWord,
  losesOnN,
  newShiritori,
  restoreShiritori,
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

type Link = { word: string; by: 'cpu' | 'you' };
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
  picker,
  onTyping,
}: {
  picker: React.ReactNode;
  onTyping: (typing: boolean) => void;
}) {
  const { t } = useLanguage();
  const [round, setRound] = useState<Round | null>(null);
  const [best, setBest] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [record, setRecord] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let saved: Round | null = null;
    try {
      saved = restoreShiritori(localStorage.getItem(SHIRITORI_KEY), valid);
      setBest(Number(localStorage.getItem(SHIRITORI_BEST_KEY)) || 0);
    } catch {
      /* Start fresh when storage is unavailable. */
    }
    setRound(saved ?? opening());
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!round) return;
    try {
      localStorage.setItem(SHIRITORI_KEY, JSON.stringify(round));
    } catch {
      /* Keep playing without saving. */
    }
  }, [round]);
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
    const chain: Link[] = [...round.chain, { word, by: 'you' }];
    if (losesOnN(word)) {
      say('「ん」で終わったので、あなたの負けです。');
      finish({ ...round, chain, draft: '', end: 'n' });
      return;
    }
    say('');
    setRound({ ...round, chain, draft: '' });
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

  const score = round ? yourWords(round) : 0;
  return (
    <section className="play-area shiritori" aria-label={t('しりとり')}>
      <div className="board-column">
        <div className="game-heading">
          {picker}
          <span>
            {t(score + '語')} · {t('最高 ' + best)}
          </span>
        </div>
        <ol className="chain" ref={list} aria-label={t('しりとりの言葉')}>
          {round?.chain.map((link, i) => (
            <li key={i} className={'chain-word ' + link.by}>
              <span className="sr-only">
                {link.by === 'you' ? t('あなた：') : t('相手：')}
              </span>
              <b lang="ja">{spelling.get(link.word) ?? link.word}</b>
              {spelling.has(link.word) &&
                spelling.get(link.word) !== link.word && (
                  <small lang="ja">{link.word}</small>
                )}
            </li>
          ))}
          {playing && round.chain.length === 1 && (
            <li className="chain-hint">
              {t(
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
              {round.end === 'cpu' ? t('あなたの勝ち') : t('おしまい')}
            </span>
            <h2>{t(score + '語')}</h2>
            <p>{record ? t('最高記録！') : t('最高 ' + best)}</p>
            <div className="result-actions">
              <button className="primary-button" onClick={restart}>
                <RotateCcw size={17} />
                {t('もう一度')}
              </button>
            </div>
          </section>
        ) : (
          <>
            <p className="next-kana">
              {t('次は')}
              <b lang="ja">「{need}」</b>
              {t('から')}
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
                  say('降参しました。');
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
