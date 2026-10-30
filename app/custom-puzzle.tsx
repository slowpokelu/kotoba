'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { convertRomaji } from '@/lib/kana-input.mjs';
import { resolveGuess } from '@/lib/game.mjs';
import { encodeWord } from '@/lib/custom.mjs';
import { routePath } from '@/lib/routes.mjs';
import { aliasesFor, allValid } from '@/lib/word-pools.mjs';
import { useKanaField } from './kana-input';
import { useLanguage } from './language';
import { SharePanel } from './share';

// Kanji typed through an IME resolve to their reading, as in the game.
const aliases: Record<string, string> = Object.assign(
  {},
  ...[3, 4, 5, 6].map(aliasesFor),
);

// 問題を作る: pick any dictionary word of three to six kana and send it as a
// link; whoever opens it plays that word.
export function CreatePuzzle({
  open,
  onOpenChange,
  base,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  base: string;
}) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState('');
  const kana = useKanaField(draft, (value) => setDraft(value.slice(0, 20)));
  const word = resolveGuess(convertRomaji(draft, true), aliases);
  const length = [...word].length;
  const problem = !word
    ? ''
    : length < 3 || length > 6
      ? 'ひらがな3〜6文字の言葉にしてください。'
      : !allValid.has(word)
        ? '辞書にない言葉です。別の言葉を試してみてください。'
        : '';
  const link =
    word && !problem
      ? new URL(
          routePath(base, 'kotoba') + '?w=' + encodeWord(word),
          window.location.origin,
        ).href
      : '';
  const invite =
    language === 'en'
      ? `I made you a Kotoba puzzle (${length} kana). Can you solve it?\n${link}`
      : `ことばの問題を作りました（${length}文字）。解けるかな？\n${link}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setDraft('');
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
          {t('答えにする言葉を入れると、その言葉で遊べるリンクができます。')}
        </DialogDescription>
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
        {problem ? (
          <p className="share-note">{t(problem)}</p>
        ) : (
          link && <SharePanel text={invite} />
        )}
      </DialogContent>
    </Dialog>
  );
}
