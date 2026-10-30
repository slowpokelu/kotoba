// Every game has its own address under the site: /double/, /double/practice/,
// /bee/ … The site root is today's ことば.
export const GAMES = [
  'kotoba',
  'double',
  'triple',
  'wadou',
  'ladder',
  'absurd',
  'bee',
  'shiritori',
];
const SLUGS = {
  kotoba: '',
  double: 'double',
  triple: 'triple',
  wadou: 'wadou',
  ladder: 'ladder',
  absurd: 'sneaky',
  bee: 'bee',
  shiritori: 'shiritori',
};
// Games with today's puzzle and a practice round; the rest have one kind.
export const HAS_PRACTICE = new Set([
  'kotoba',
  'double',
  'triple',
  'wadou',
  'ladder',
]);
export const HAS_DAILY = new Set([
  'kotoba',
  'double',
  'triple',
  'wadou',
  'ladder',
  'bee',
]);
export const SITE = 'https://slowpokelu.github.io/kotoba/';

// The game in a path, and the site base in front of it.
export function parseRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  let practice = false;
  if (parts.at(-1) === 'practice') {
    practice = true;
    parts.pop();
  }
  const game = GAMES.find((g) => SLUGS[g] && SLUGS[g] === parts.at(-1));
  if (game) parts.pop();
  const found = game ?? 'kotoba';
  return {
    game: found,
    practice: practice && HAS_PRACTICE.has(found),
    base: '/' + parts.map((p) => p + '/').join(''),
  };
}
export const routePath = (base, game, practice = false) =>
  base +
  (SLUGS[game] ? SLUGS[game] + '/' : '') +
  (practice && HAS_PRACTICE.has(game) ? 'practice/' : '');
// Every route below the base, for the static build.
export const ROUTE_PATHS = GAMES.flatMap((game) =>
  [false, true]
    .filter((practice) => !practice || HAS_PRACTICE.has(game))
    .map((practice) => routePath('', game, practice)),
).filter(Boolean);
export const shareLink = (game, practice = false) =>
  routePath(SITE, game, practice);
