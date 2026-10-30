'use client';
import { useLanguage } from './language';

// The round's modes, beside its count in the heading row.
export function ModeChips({ hard, hints }: { hard: boolean; hints: boolean }) {
  const { t } = useLanguage();
  if (!hard && !hints) return null;
  return (
    <span className="mode-chips" aria-label={t('この問題のモード')}>
      {hard && <b className="mode-badge hard">{t('ハード')}</b>}
      {hints && <b className="mode-badge hints">{t('ヒント')}</b>}
    </span>
  );
}

// What the colours mean, under the board on computers; phones leave it to
// the help.
export function Legend({ hints }: { hints: boolean }) {
  const { t } = useLanguage();
  return (
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
  );
}
