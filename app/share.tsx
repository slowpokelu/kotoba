'use client';
/* oxlint-disable react/react-compiler -- Browser capabilities are read after hydration. */
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { useLanguage } from './language';

export const jisho = (word: string) =>
  'https://jisho.org/search/' + encodeURIComponent(word);

// A mouse can look up guesses mid-game; touch waits for the result so a
// stray tap near the keyboard never leaves the puzzle.
export function useFinePointer() {
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return finePointer;
}

// A preview of the text with the system share sheet (where the browser has
// one) and a copy button.
export function SharePanel({
  text,
  onShared,
}: {
  text: string;
  onShared?: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  const [canShare, setCanShare] = useState(false);
  const preview = useRef<HTMLPreElement>(null);
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function');
  }, []);
  useEffect(() => setCopied(''), [text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      // Select the preview so a long press or Ctrl+C still works.
      const range = document.createRange();
      if (preview.current) range.selectNodeContents(preview.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      setCopied('no');
    }
  }
  async function share() {
    try {
      await navigator.share({ text });
      onShared?.();
    } catch {
      /* Cancelled, or the sheet is unavailable; copying still works. */
    }
  }
  return (
    <>
      <pre
        ref={preview}
        className="share-preview"
        aria-label={t('共有する結果')}
      >
        {text}
      </pre>
      <div className="dialog-actions">
        {canShare && (
          <button className="primary-button" onClick={share}>
            <Share2 size={17} />
            {t('共有')}
          </button>
        )}
        <button
          className={canShare ? 'secondary-button' : 'primary-button'}
          onClick={copy}
        >
          {copied === 'yes' ? <Check size={17} /> : <Copy size={17} />}
          {copied === 'yes' ? t('コピーしました') : t('コピー')}
        </button>
      </div>
      <output className="share-note">
        {copied === 'no'
          ? t('コピーできませんでした。上の結果を選択してコピーしてください。')
          : ''}
      </output>
    </>
  );
}

// 結果を共有: opens the preview in a dialog.
export function ShareButton({ text }: { text: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <Share2 size={17} />
        {t('結果を共有')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
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
          <DialogTitle className="help-title">{t('結果を共有')}</DialogTitle>
          {open && <SharePanel text={text} onShared={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Share texts are written in Japanese; this is the English copy.
export const englishShare = (text: string) =>
  text
    .replace('ことば', 'Kotoba')
    .replace('友だちの問題', "A friend's puzzle")
    .replace('練習', 'Practice')
    .replace('いじわる', 'Sneaky')
    .replace('ダブル', 'Double')
    .replace('トリプル', 'Triple')
    .replace('ふたりでしりとり', 'Shiritori for two')
    .replace('しりとり', 'Shiritori')
    .replace('和同開珎', 'Kanji cross')
    .replace('はしご', 'Word ladder')
    .replace(/(\d+|X)(?:手)?（最短(\d+)手）/, (_, n, par) =>
      n === 'X' ? `X (par ${par})` : `${n} steps (par ${par})`,
    )
    .replace('[ハード]', '[Hard]')
    .replace('[ヒント]', '[Hints]')
    .replace(/(\d)文字/, '$1 kana')
    .replace(/ (\d+)手\n/, ' $1 guesses\n')
    .replace(/ (\d+)語\n/, ' $1 words\n');
