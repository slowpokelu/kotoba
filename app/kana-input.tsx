'use client';
/* oxlint-disable typescript/no-misused-spread -- NFC kana are deliberately counted as individual code points, including small kana. */
/* oxlint-disable typescript/no-deprecated -- keyCode 229 covers Safari IME confirmation, where isComposing can be false. */
import { useLayoutEffect, useRef, useState } from 'react';
import { Delete, Keyboard } from 'lucide-react';
import { convertInput, convertRomaji } from '@/lib/kana-input.mjs';
import { labels, marks, modifyLast, normalize } from '@/lib/game.mjs';
import type { Status } from '@/lib/types';
import { useLanguage } from './language';

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

// Romaji, IME and on-screen kana editing for one text field. `value` is the
// draft and `onValue` stores the next one; the caret follows conversions.
export function useKanaField(value: string, onValue: (next: string) => void) {
  const field = useRef<HTMLInputElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const composing = useRef(false);
  const compositionEnd = useRef(0);
  useLayoutEffect(() => {
    if (selection.current && !composing.current)
      field.current?.setSelectionRange(
        selection.current.start,
        selection.current.end,
      );
    selection.current = null;
  }, [value]);
  // True while an IME is composing, or just confirmed (Enter then belongs to it).
  const composingNow = () =>
    composing.current || Date.now() - compositionEnd.current < 150;
  const inputProps = {
    ref: field,
    value,
    lang: 'ja',
    autoComplete: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      if (composingNow() || (e.nativeEvent as InputEvent).isComposing)
        onValue(input.value);
      else {
        const next = convertInput(
          input.value,
          input.selectionStart ?? input.value.length,
          input.selectionEnd ?? input.value.length,
        );
        selection.current = next;
        onValue(next.value);
      }
    },
    onCompositionStart: () => {
      selection.current = null;
      composing.current = true;
    },
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => {
      composing.current = false;
      compositionEnd.current = Date.now();
      onValue(normalize(e.currentTarget.value));
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === 'Enter' &&
        (e.nativeEvent.isComposing || e.keyCode === 229 || composingNow())
      )
        e.preventDefault();
    },
  };
  // Leaving the field finishes a pending syllable, such as a final n.
  function commit() {
    const done = normalize(convertRomaji(value, true));
    if (!composing.current && value !== done) onValue(done);
  }
  // Inserts at the caret; returns false when the word would be too long.
  function insert(kana: string, maxKana: number) {
    const input = field.current;
    const start = input?.selectionStart ?? value.length,
      end = input?.selectionEnd ?? start;
    const next = convertInput(
      value.slice(0, start) + kana + value.slice(end),
      start + kana.length,
    );
    if ([...normalize(next.value)].length > maxKana) return false;
    selection.current = next;
    onValue(next.value);
    return true;
  }
  function erase() {
    const start = field.current?.selectionStart ?? value.length,
      end = field.current?.selectionEnd ?? start;
    const caret = start === end ? Math.max(0, start - 1) : start;
    selection.current = { start: caret, end: caret };
    onValue(value.slice(0, caret) + value.slice(end));
  }
  function modify(kind: 'voice' | 'small') {
    onValue(modifyLast(value, kind));
  }
  return { field, inputProps, composingNow, commit, insert, erase, modify };
}

// The on-screen kana keyboard. Keys never take focus, so the phone keyboard
// stays closed while tapping them.
export function KanaKeyboard({
  keys = {},
  split,
  disabled,
  finished = false,
  onInsert,
  onModify,
  onErase,
}: {
  keys?: Record<string, Status>;
  // ダブル: each key shows the left and right board as two halves.
  split?: Record<string, [Status | null, Status | null]>;
  disabled: boolean;
  finished?: boolean;
  onInsert: (kana: string) => void;
  onModify: (kind: 'voice' | 'small') => void;
  onErase: () => void;
}) {
  const { t } = useLanguage();
  const [extra, setExtra] = useState(false);
  const keep = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className={'keyboard-section ' + (finished ? 'finished' : '')}>
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
          extra ? t('濁音と小文字のキーボード') : t('五十音キーボード')
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
                className={'kana-key ' + (split ? 'split' : keys[k] || '')}
                data-left={split?.[k]?.[0] ?? undefined}
                data-right={split?.[k]?.[1] ?? undefined}
                disabled={disabled}
                aria-label={
                  k +
                  (split?.[k]
                    ? split[k]
                        .map(
                          (s, i) =>
                            '、' +
                            t(i ? '右' : '左') +
                            '：' +
                            (s ? t(labels[s]) : t('未判定')),
                        )
                        .join('')
                    : keys[k]
                      ? '、' + t(labels[keys[k]])
                      : '')
                }
                onPointerDown={keep}
                onClick={() => onInsert(k)}
              >
                {k}
                {!split && keys[k] && (
                  <small aria-hidden="true">{marks[keys[k]]}</small>
                )}
              </button>
            ),
          ),
        )}
      </div>
      <div className="keyboard-tools">
        <button
          disabled={disabled}
          onPointerDown={keep}
          onClick={() => onModify('voice')}
          aria-label={t('最後のかなの濁点・半濁点を切り替え')}
        >
          ゛<span> / </span>゜
        </button>
        <button
          disabled={disabled}
          onPointerDown={keep}
          onClick={() => onModify('small')}
        >
          {t('大 ↔ 小')}
        </button>
        <button
          className="erase-key"
          disabled={disabled}
          onPointerDown={keep}
          onClick={onErase}
          aria-label={t('1文字消す')}
        >
          <Delete size={19} />
          {t('消す')}
        </button>
      </div>
    </div>
  );
}
