'use client';
import { useLanguage } from './language';

// Under a board: the round's mode chips, then what the colours mean. The chip
// row keeps its height on computers, so nothing moves when a mode applies;
// phones show no legend (the help explains the colours).
export function BoardKey({ hard, hints }: { hard: boolean; hints: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <div
        className="mode-chips"
        aria-label={hard || hints ? t('この問題のモード') : undefined}
      >
        {hard && <b className="mode-badge hard">{t('ハード')}</b>}
        {hints && <b className="mode-badge hints">{t('ヒント')}</b>}
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
        {hints && (
          <span>
            <i className="near-correct">✓</i>
            <i className="near-present">●</i>
            {t('濁点・大小違い')}
          </span>
        )}
        <span>
          <i className="absent">−</i>
          {t('なし')}
        </span>
      </div>
    </>
  );
}
