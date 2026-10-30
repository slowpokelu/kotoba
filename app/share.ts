'use client';
/* oxlint-disable react/react-compiler -- Browser capabilities are read after hydration. */
import { useEffect, useState } from 'react';

// Phones share results through the system sheet; computers copy them.
export function useCanShare() {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(
      typeof navigator.share === 'function' &&
        window.matchMedia('(pointer: coarse)').matches,
    );
  }, []);
  return canShare;
}

export async function sendResult(
  text: string,
  canShare: boolean,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (canShare)
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Any other failure falls back to copying.
    }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// Share texts are written in Japanese; this is the English copy.
export const englishShare = (text: string) =>
  text
    .replace('ことば', 'Kotoba')
    .replace('練習', 'Practice')
    .replace('いじわる', 'Sneaky')
    .replace('ダブル', 'Double')
    .replace('[ハード]', '[Hard]')
    .replace('[ヒント]', '[Hints]')
    .replace(/(\d)文字/, '$1 kana')
    .replace(/ (\d+)手\n/, ' $1 guesses\n');
