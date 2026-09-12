import {
  evaluate,
  gameLength,
  LIMIT,
  marks,
  outcome,
  shareText,
} from './game.mjs';

export function resultCard(game, day, language = 'ja') {
  const length = gameLength(game.id);
  return {
    title: language === 'en' ? 'Kotoba' : 'ことば',
    label: game.id.startsWith('daily:')
      ? day
      : language === 'en'
        ? `Practice · ${length} kana`
        : `練習 · ${length}文字`,
    score: `${outcome(game) === 'won' ? game.guesses.length : 'X'}/${LIMIT}`,
    length,
    rows: game.guesses.map((guess) => evaluate(guess, game.answer)),
    text:
      language === 'en'
        ? shareText(game, day)
            .replace('ことば', 'Kotoba')
            .replace('練習', 'Practice')
            .replace(/(\d)文字/, '$1 kana')
        : shareText(game, day),
    filename: `kotoba-${game.id.startsWith('daily:') ? day : `practice-${length}`}.png`,
  };
}

// Render only the public result: no answer, guesses, or stored player data.
export function drawResultCard(canvas, card, dark = false) {
  const colors = dark
    ? {
        bg: '#172236',
        fg: '#e3eaf7',
        muted: '#a7b6d0',
        correct: '#94b0ff',
        present: '#edc46d',
        absent: '#303b4c',
      }
    : {
        bg: '#ffffff',
        fg: '#172849',
        muted: '#52617b',
        correct: '#254cca',
        present: '#edc46d',
        absent: '#e6ebf3',
      };
  const cell = 56,
    gap = 12,
    top = 224;
  canvas.width = 720;
  canvas.height = top + Math.max(1, card.rows.length) * (cell + gap) + 88;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.correct;
  ctx.fillRect(0, 0, canvas.width, 8);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.fg;
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(card.title, 56, 78);
  ctx.font = '600 64px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(card.score, 664, 83);
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.muted;
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(card.label, 56, 140);
  const left = (canvas.width - card.length * (cell + gap) + gap) / 2;
  card.rows.forEach((row, r) =>
    row.forEach((status, c) => {
      const x = left + c * (cell + gap),
        y = top + r * (cell + gap);
      ctx.fillStyle = colors[status];
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle =
        status === 'correct' && !dark
          ? '#ffffff'
          : status === 'absent' && dark
            ? '#e3eaf7'
            : '#172849';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(marks[status], x + cell / 2, y + cell / 2);
    }),
  );
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'center';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('slowpokelu.github.io/kotoba/', 360, canvas.height - 42);
}
