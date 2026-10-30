'use client';
import { useState } from 'react';
import { Play, Shuffle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { convertRomaji } from '@/lib/kana-input.mjs';
import { PRACTICE_LENGTHS, resolveGuess } from '@/lib/game.mjs';
import { encodeWord } from '@/lib/custom.mjs';
import { routePath } from '@/lib/routes.mjs';
import { aliasesFor, allValid, answersFor } from '@/lib/word-pools.mjs';
import { useKanaField } from './kana-input';
import { useLanguage } from './language';
import { SharePanel } from './share';

// Kanji typed through an IME resolve to their reading, as in the game.
const aliases: Record<string, string> = Object.assign(
  {},
  ...[3, 4, 5, 6].map(aliasesFor),
);
const randomWord = (length: number) => {
  const pool = answersFor(length);
  return pool[Math.floor(Math.random() * pool.length)].reading as string;
};

// 問題を作る: a link to one word that everyone who opens it plays. By default
// the word is an everyday one picked at random and shown to no one, so the
// sender can play it too; choosing a word yourself is the other option.
export function CreatePuzzle({
  open,
  onOpenChange,
  base,
  onPlay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base: string;
  onPlay: (code: string) => void;
}) {
  const { t, language } = useLanguage();
  const [own, setOwn] = useState(false);
  const [length, setLength] = useState(4);
  const [secret, setSecret] = useState(() => randomWord(4));
  const [draft, setDraft] = useState('');
  const kana = useKanaField(draft, (value) => setDraft(value.slice(0, 20)));
  const typed = resolveGuess(convertRomaji(draft, true), aliases);
  const typedLength = [...typed].length;
  const problem =
    !own || !typed
      ? ''
      : typedLength < 3 || typedLength > 6
        ? 'ひらがな3〜6文字の言葉にしてください。'
        : !allValid.has(typed)
          ? '辞書にない言葉です。別の言葉を試してみてください。'
          : '';
  const word = own ? (problem ? '' : typed) : secret;
  const code = word ? encodeWord(word) : '';
  const link = code
    ? new URL(routePath(base, 'kotoba') + '?w=' + code, window.location.origin)
        .href
    : '';
  const kanaCount = [...word].length;
  const invite =
    language === 'en'
      ? `A Kotoba puzzle (${kanaCount} kana). Same word for everyone. Can you solve it?\n${link}`
      : `ことばの問題（${kanaCount}文字）。みんな同じ言葉です。解けるかな？\n${link}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setDraft('');
          setOwn(false);
          setSecret(randomWord(length));
        }
      }}
    >
      <DialogContent
        className="help-dialog share-dialog"
        showCloseButton={false}
      >
        <DialogClose
          className="icon-button dialog-close"
          aria-label={t('閉じる')}
        >
          <X size={20} />
        </DialogClose>
        <DialogTitle className="help-title">{t('問題を作る')}</DialogTitle>
        <DialogDescription className="help-intro">
          {own
            ? t('答えにする言葉を入れると、その言葉で遊べるリンクができます。')
            : t(
                'よく使う言葉からおまかせで選びます。言葉は誰にも見えません。リンクを開いた人はみんな同じ言葉で遊べて、自分も遊べます。',
              )}
        </DialogDescription>
        {own ? (
          <label className="custom-word">
            <span>{t('答え（ひらがな3〜6文字）')}</span>
            <input
              {...kana.inputProps}
              id="custom-word"
              placeholder={t('ここに入力')}
              aria-invalid={!!problem || undefined}
              onBlur={kana.commit}
            />
          </label>
        ) : (
          <div className="length-picker custom-length">
            <span id="custom-length-label">{t('文字数')}</span>
            <RadioGroup
              className="length-options"
              aria-labelledby="custom-length-label"
              value={String(length)}
              onValueChange={(value) => {
                setLength(Number(value));
                setSecret(randomWord(Number(value)));
              }}
            >
              {PRACTICE_LENGTHS.map((n: number) => (
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
            <button
              type="button"
              className="icon-button"
              aria-label={t('別の言葉にする')}
              title={t('別の言葉にする')}
              onClick={() => setSecret(randomWord(length))}
            >
              <Shuffle size={17} />
            </button>
          </div>
        )}
        {problem ? (
          <p className="share-note">{t(problem)}</p>
        ) : (
          link && (
            <>
              <SharePanel text={invite} />
              {!own && (
                <button
                  className="secondary-button custom-play"
                  onClick={() => {
                    onOpenChange(false);
                    onPlay(code);
                  }}
                >
                  <Play size={16} />
                  {t('自分も遊ぶ')}
                </button>
              )}
            </>
          )
        )}
        <button
          type="button"
          className="text-button custom-switch"
          onClick={() => {
            setOwn(!own);
            setDraft('');
          }}
        >
          {own ? t('おまかせで作る') : t('言葉を自分で決める')}
        </button>
      </DialogContent>
    </Dialog>
  );
}
