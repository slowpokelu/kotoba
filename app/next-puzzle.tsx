'use client';
/* oxlint-disable react/react-compiler -- No React compiler is enabled; the countdown ticks in an effect. */
import { useEffect, useState } from 'react';
import { useLanguage } from './language';

// Counts down to local midnight, when the next daily puzzle starts.
export function NextPuzzle() {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const left = Math.max(0, midnight.getTime() - now);
  const time = [3600000, 60000, 1000]
    .map((unit, i) =>
      String(Math.floor(left / unit) % (i ? 60 : 24)).padStart(2, '0'),
    )
    .join(':');
  return (
    <p className="next-day">
      {t('次の一問まで')} <time>{time}</time>
    </p>
  );
}
