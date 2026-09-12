'use client';
import { useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { marks } from '@/lib/game.mjs';
import { resultCard, drawResultCard } from '@/lib/share-card.mjs';
import { useLanguage } from './language';

type Game = { id: string; answer: string; guesses: string[]; gaveUp?: boolean };

export function ShareResult({ game, day }: { game: Game; day: string }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [fallback, setFallback] = useState(false);
  const card = resultCard(game, day, language);

  async function copy() {
    setPending(true);
    setNotice('');
    try {
      await navigator.clipboard.writeText(card.text);
      setFallback(false);
      setNotice('結果をコピーしました。');
    } catch {
      setFallback(true);
      setNotice('下の結果を選択してコピーできます。');
    } finally {
      setPending(false);
    }
  }

  async function share() {
    setPending(true);
    setNotice('');
    try {
      // Invoke directly from this click, while user activation is available.
      await navigator.share({ title: card.title, text: card.text });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setFallback(true);
        setNotice('共有できませんでした。コピーか画像の保存をお試しください。');
      }
    } finally {
      setPending(false);
    }
  }

  async function saveImage() {
    setPending(true);
    setNotice('');
    try {
      const canvas = document.createElement('canvas');
      drawResultCard(
        canvas,
        card,
        document.documentElement.dataset.theme === 'dark',
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error('Image unavailable')),
          'image/png',
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = card.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('画像を保存しました。');
    } catch {
      setNotice('画像を保存できませんでした。結果をコピーしてください。');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="secondary-button"
        onClick={() => {
          setNativeAvailable(typeof navigator.share === 'function');
          setNotice('');
          setFallback(false);
          setOpen(true);
        }}
      >
        <Share2 size={17} />
        {t('結果をシェア')}
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
          <DialogTitle className="help-title">{t('結果をシェア')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('答えを含まない結果を共有します。')}
          </DialogDescription>
          <div
            className="share-card"
            aria-label={`${card.title} · ${card.label} · ${card.score}`}
          >
            <div className="share-card-heading">
              <strong>{card.title}</strong>
              <span>{card.score}</span>
            </div>
            <p className="share-card-label">{card.label}</p>
            <div
              className="share-grid"
              style={{
                gridTemplateColumns: `repeat(${card.length}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {card.rows.flatMap((row: string[], r: number) =>
                row.map((status, c) => (
                  <span className={`share-tile ${status}`} key={`${r}-${c}`}>
                    {marks[status as keyof typeof marks]}
                  </span>
                )),
              )}
            </div>
            <span className="share-card-url">slowpokelu.github.io/kotoba/</span>
          </div>
          <div className="share-actions">
            {nativeAvailable && (
              <button
                className="primary-button"
                onClick={share}
                disabled={pending}
              >
                <Share2 size={17} />
                {t('シェア…')}
              </button>
            )}
            <button
              className={
                nativeAvailable ? 'secondary-button' : 'primary-button'
              }
              onClick={copy}
              disabled={pending}
            >
              <Copy size={17} />
              {t('結果をコピー')}
            </button>
            <button
              className="secondary-button"
              onClick={saveImage}
              disabled={pending}
            >
              <Download size={17} />
              {t('画像を保存')}
            </button>
          </div>
          {notice && <output className="share-notice">{t(notice)}</output>}
          {fallback && (
            <textarea
              className="share-fallback"
              aria-label={t('コピー用の結果')}
              value={card.text}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
