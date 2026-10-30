import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'https://kotoba.test', pretendToBeVisual: true },
);
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'localStorage',
  'getComputedStyle',
])
  Object.defineProperty(globalThis, key, {
    value:
      key === 'getComputedStyle'
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[key],
    configurable: true,
    writable: true,
  });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
let finePointer = false;
let coarsePointer = false;
window.matchMedia = (query) => ({
  matches:
    (finePointer && query.includes('pointer: fine')) ||
    (coarsePointer && query.includes('pointer: coarse')),
  addEventListener() {},
  removeEventListener() {},
});
HTMLElement.prototype.scrollIntoView = function () {};
window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { default: Home } = await import('../app/page.tsx');
const { answers } = await import('../lib/answers.mjs');
let root;
const mount = async () => {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Home)));
};
const unmount = async () => {
  await act(async () => root.unmount());
};
const text = () => document.body.textContent;
const button = (label) =>
  [...document.querySelectorAll('button, .cadence a')].find(
    (b) =>
      b.textContent.trim() === label ||
      b.getAttribute('aria-label') === label ||
      b.getAttribute('aria-label')?.startsWith(label + '、'),
  );
const click = async (label) => {
  const b = button(label);
  assert.ok(b, 'button exists: ' + label);
  await act(async () => {
    // Links get a real click event: the backup tests stub anchor clicks.
    b.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 25));
  });
};
// Opens the game menu and follows a game's link.
const chooseGame = async (name) => {
  await act(async () => document.querySelector('.game-switch').click());
  const link = [...document.querySelectorAll('.game-list a')].find(
    (a) => a.querySelector('b').textContent === name,
  );
  assert.ok(link, 'game exists: ' + name);
  await act(async () => {
    link.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 25));
  });
};
const type = async (value, start = value.length, end = start) => {
  const input = document.querySelector('#guess');
  assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(input, value);
    input.setSelectionRange(start, end);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
};
// Compare DOM nodes by identity. A failing assert.equal would diff jsdom's
// whole object graph, which never finishes and gets the CI runner killed.
const sameNode = (actual, expected, message) =>
  assert.ok(actual === expected, message);
const absent = (selector, message = selector + ' is absent') =>
  assert.ok(!document.querySelector(selector), message);
const waitFor = async (condition) => {
  for (let i = 0; i < 40 && !condition(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
};
const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 700));
  });
};
const saved = () =>
  JSON.parse(
    localStorage.getItem(
      [...Array(localStorage.length)]
        .map((_, i) => localStorage.key(i))
        .find((k) => k.includes('daily:')),
    ),
  );

Object.defineProperty(navigator, 'languages', {
  value: ['ja-JP', 'en'],
  configurable: true,
});
await mount();
assert.equal(
  document.documentElement.lang,
  'ja',
  'a Japanese browser starts in Japanese',
);
await unmount();
Object.defineProperty(navigator, 'languages', {
  value: ['en-US'],
  configurable: true,
});
await mount();
assert.equal(document.documentElement.lang, 'en', 'English is the default');
const pressed = (id) =>
  document.querySelector(id).getAttribute('aria-pressed') === 'true';
assert.equal(document.querySelector('#language-en').textContent.trim(), 'EN');
assert.equal(document.querySelector('#language-ja').textContent.trim(), 'JP');
assert.ok(pressed('#language-en') && !pressed('#language-ja'));
await click('日本語');
assert.ok(pressed('#language-ja') && !pressed('#language-en'));
assert.equal(document.querySelectorAll('.board .tile').length, 32);
assert.equal(document.querySelectorAll('.guess-row .current').length, 4);
const inputField = () => document.querySelector('#guess');
inputField().focus();
for (const letter of 'gakkou') await type(inputField().value + letter);
assert.equal(inputField().value, 'がっこう', 'romaji converts as it is typed');
await act(async () => document.querySelector('#language-en').click());
assert.equal(document.documentElement.lang, 'en');
assert.equal(
  inputField().value,
  'がっこう',
  'language switching preserves the draft',
);
await act(async () => document.querySelector('#language-ja').click());
inputField().focus();
sameNode(document.activeElement, inputField(), 'conversion preserves focus');
assert.equal(inputField().selectionStart, 4, 'caret follows converted kana');
await type('がっk');
assert.deepEqual(
  [...document.querySelectorAll('.tile.current > span')].map(
    (t) => t.textContent,
  ),
  ['が', 'っ', '', ''],
  'unfinished syllables keep the existing tiles visible',
);
await type('かshaく', 4);
assert.equal(inputField().value, 'かしゃく');
assert.equal(
  inputField().selectionStart,
  3,
  'middle insertion keeps its caret',
);
await type('あいうえ');
inputField().setSelectionRange(1, 3);
await click('か');
assert.equal(inputField().value, 'あかえ', 'kana key replaces a selection');
assert.equal(inputField().selectionStart, 2);
inputField().setSelectionRange(1, 2);
await click('1文字消す');
assert.equal(inputField().value, 'あえ');
assert.equal(
  inputField().selectionStart,
  1,
  'selection deletion retains its start',
);
await type('');
inputField().focus();
await type('n');
assert.equal(inputField().value, 'n', 'one n stays pending');
await type(inputField().value + 'n');
assert.equal(inputField().value, 'ん', 'two n presses immediately finish ん');
assert.equal(inputField().selectionStart, 1, 'caret follows the completed ん');
sameNode(document.activeElement, inputField(), 'double n keeps focus');
assert.equal(document.querySelector('.tile.current > span').textContent, 'ん');
assert.equal(saved().draft, 'ん', 'the saved draft has no leftover n');
await click('1文字消す');
assert.equal(inputField().value, '', 'one deletion removes the completed ん');
for (const letter of 'shinnbunn') await type(inputField().value + letter);
assert.equal(
  inputField().value,
  'しんぶん',
  'word-final nn completes before submit',
);
await type('');
for (const letter of 'konnnichiha') await type(inputField().value + letter);
assert.equal(inputField().value, 'こんにちは', 'nn followed by ni gives んに');
await type('かく');
await type('かnく', 2);
assert.equal(inputField().value, 'かnく', 'n typed mid-word stays pending');
assert.deepEqual(
  [...document.querySelectorAll('.tile.current > span')]
    .map((t) => t.textContent)
    .slice(0, 2),
  ['か', 'く'],
  'a pending mid-word n keeps the tile preview',
);
await type('かnaく', 3);
assert.equal(inputField().value, 'かなく', 'n plus a vowel gives な mid-word');
assert.equal(inputField().selectionStart, 2, 'caret stays after な');
await type('かnく', 2);
await act(async () => inputField().blur());
assert.equal(inputField().value, 'かんく', 'leaving the field commits ん');
inputField().focus();
await type('ＳＨＩＮＢＵＮ');
assert.equal(
  inputField().value,
  'しんぶn',
  'pasted full-width romaji converts',
);
await unmount();
await mount();
assert.equal(document.documentElement.lang, 'ja', 'saved Japanese is restored');
assert.equal(inputField().value, 'しんぶn', 'pending romaji survives reload');
await type('あ');
await submit();
assert.ok(text().includes('ひらがな4文字で入力してください'));
assert.equal(saved().guesses.length, 0);
await act(async () => {
  document
    .querySelector('#guess')
    .dispatchEvent(
      new dom.window.CompositionEvent('compositionstart', { bubbles: true }),
    );
});
await type('ｶﾞｯｺｳ');
assert.equal(inputField().value, 'ｶﾞｯｺｳ', 'active native IME is not rewritten');
await submit();
assert.equal(saved().guesses.length, 0, 'composition must not spend a guess');
await act(async () => {
  const enter = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    isComposing: true,
  });
  document.querySelector('#guess').dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, true, 'IME Enter is not a submit');
  document.querySelector('#guess').dispatchEvent(
    new dom.window.CompositionEvent('compositionend', {
      bubbles: true,
      data: 'ガッコウ',
    }),
  );
});
await submit();
assert.equal(
  saved().guesses.length,
  0,
  'IME confirmation must not double-submit',
);
await act(async () => {
  await new Promise((r) => setTimeout(r, 180));
});
const guessField = document.querySelector('#guess');
guessField.focus();
await submit();
sameNode(document.activeElement, guessField, 'submission preserves focus');
assert.equal(guessField.disabled, false, 'reveal must not disable the input');
assert.equal(guessField.readOnly, true, 'reveal temporarily locks editing');
await submit();
await settle();
sameNode(document.activeElement, guessField, 'focus survives the reveal');
assert.equal(guessField.readOnly, false, 'typing resumes after the reveal');
assert.equal(saved().guesses[0], 'がっこう');
absent('a.guess-row', 'touch cannot open the dictionary mid-game');
await type('がっこう');
button('回答する').focus();
await submit();
sameNode(
  document.activeElement,
  guessField,
  'button submission returns focus even for errors',
);
assert.ok(text().includes('その言葉はもう試しました'));
assert.ok(
  document.querySelector('.guess-row.shake .tile.current'),
  'a refused guess shakes the row being typed',
);
assert.equal(saved().guesses.length, 1);
await act(async () => guessField.blur());
await act(async () =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', bubbles: true }),
  ),
);
sameNode(
  document.activeElement,
  guessField,
  'typing anywhere focuses the field',
);
await type('ひま');
await unmount();
finePointer = true;
await mount();
assert.equal(document.querySelector('#guess').value, 'ひま');
const guessLink = document.querySelector('a.guess-row');
assert.equal(
  guessLink?.href,
  'https://jisho.org/search/' + encodeURIComponent('がっこう'),
  'a mouse can look up a submitted guess mid-game',
);
assert.equal(guessLink.target, '_blank');
assert.equal(
  guessLink.title,
  '辞書で見る',
  'hovering a guess explains the link',
);
assert.equal(document.querySelectorAll('a.guess-row').length, 1);
document.querySelector('#guess').focus();
assert.equal(
  guessLink.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
  ),
  false,
  'pressing a guess keeps focus in the field',
);
await unmount();
finePointer = false;
await mount();
assert.equal(saved().guesses.length, 1);
await type('');
await click('か');
await click('最後のかなの濁点・半濁点を切り替え');
assert.equal(document.querySelector('#guess').value, 'が');
await click('つ');
await click('大 ↔ 小');
await click('こ');
await click('う');
assert.equal(document.querySelector('#guess').value, 'がっこう');
await click('1文字消す');
assert.equal(document.querySelector('#guess').value, 'がっこ');
await click('濁音・小文字');
assert.ok(button('ぱ'));
await click('五十音に戻す');
await click('遊び方');
assert.ok(document.querySelector('[role="dialog"]'));
await click('閉じる');
await click('練習');
assert.ok(document.querySelector('.length-picker'));
await type('にん');
await click('今日の一問');
assert.equal(document.querySelector('#guess').value, 'がっこ');
await click('練習');
assert.equal(document.querySelector('#guess').value, 'にん');
await click('今日の一問');
await type(saved().answer);
await submit();
await settle();
assert.ok(document.querySelector('.result-card'));
assert.equal(
  document.querySelector('.result-card .eyebrow').textContent,
  '正解',
);
assert.ok(
  document.querySelector('.status .sr-only').textContent.includes('正解'),
  'the win is announced to screen readers only; the card shows it',
);
assert.match(
  document.querySelector('.next-day time').textContent,
  /^\d\d:\d\d:\d\d$/,
  'the result shows a countdown to the next puzzle',
);
await click('成績');
assert.ok(
  document.querySelector('.distribution-row.today'),
  "today's solve is highlighted",
);
await click('閉じる');
const rowLinks = [...document.querySelectorAll('a.guess-row')].map((a) =>
  decodeURIComponent(a.href.replace('https://jisho.org/search/', '')),
);
assert.equal(rowLinks[0], 'がっこう', 'finished guesses link on touch');
assert.equal(
  rowLinks.at(-1),
  answers.find((a) => a.reading === saved().answer).spelling,
  'the solved row looks up the answer spelling',
);
assert.equal(rowLinks.length, saved().guesses.length);
await unmount();
await mount();
assert.ok(
  document.querySelector('.result-card'),
  'completed result survives reload',
);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: async () => {
      throw Error('denied');
    },
  },
  configurable: true,
});
await click('結果を共有');
assert.ok(document.querySelector('.share-dialog'), 'share opens a preview');
const sharedResult = document.querySelector('.share-preview').textContent;
assert.ok(sharedResult.endsWith('https://slowpokelu.github.io/kotoba/'));
assert.ok(
  !sharedResult.includes(saved().answer),
  'shared result has no answer',
);
absent('.share-dialog .primary-button[aria-label="共有"]');
await click('コピー');
assert.ok(
  text().includes('コピーできませんでした'),
  'a failed copy says to select the preview',
);
let copiedResult;
navigator.clipboard.writeText = async (value) => {
  copiedResult = value;
};
await click('コピー');
assert.equal(copiedResult, sharedResult, 'copy takes the previewed result');
assert.ok(button('コピーしました'), 'the copy button confirms');
await click('閉じる');
await waitFor(() => !document.querySelector('.share-dialog'));
absent('.share-dialog', 'the preview closes');
navigator.clipboard.writeText = async () => {
  throw new Error('denied');
};
await click('もう一問');
assert.equal(document.querySelectorAll('.guess-row .correct').length, 0);
assert.equal(document.querySelector('#guess').value, '');
const practice = JSON.parse(localStorage.getItem('kotoba:v1:practice'));
// Exhaust a round through real form events.
for (const a of answers
  .filter((a) => a.reading !== practice.answer)
  .slice(0, 8)) {
  await type(a.reading);
  await submit();
  await settle();
}
assert.ok(text().includes('今回の答え'));
assert.ok(document.querySelector('.result-card'));
assert.ok([...document.querySelectorAll('.kana-key')].every((b) => b.disabled));
await unmount();
localStorage.clear();
const { localDay } = await import('../lib/game.mjs');
localStorage.setItem('kotoba:v1:daily:' + localDay(), 'invalid-json');
// The address picks the game; back to today's ことば.
dom.window.history.replaceState(null, '', '/');
await mount();
await click('日本語');
assert.equal(
  saved().guesses.length,
  0,
  'corrupt save recovers to a fresh game',
);
await unmount();
const originalSetItem = dom.window.Storage.prototype.setItem;
dom.window.Storage.prototype.setItem = function () {
  throw new Error('blocked');
};
await mount();
assert.ok(
  text().includes('途中の記録を保存できません'),
  'storage failure is visible',
);
await type('しんぶん');
await submit();
await settle();
assert.equal(
  document.querySelectorAll('.board .filled').length,
  4,
  'game remains playable when storage is unavailable',
);
await unmount();
dom.window.Storage.prototype.setItem = originalSetItem;
localStorage.clear();
dom.window.history.replaceState(null, '', '/');
await mount();
await click('日本語');
await click('答えを見る');
assert.ok(document.querySelector('[role="alertdialog"]'));
assert.deepEqual(
  [
    ...document.querySelectorAll('[role="alertdialog"] .dialog-actions button'),
  ].map((b) => b.textContent.trim()),
  ['終了して答えを見る', '続ける'],
  'give up is left and continue is right',
);
await waitFor(() => document.activeElement === button('続ける'));
sameNode(
  document.activeElement,
  button('続ける'),
  'continue keeps initial focus',
);
await click('続ける');
assert.equal(saved().gaveUp, false, 'cancel does not surrender');
await click('答えを見る');
await click('終了して答えを見る');
assert.ok(document.querySelector('.result-card'));
assert.equal(saved().gaveUp, true);
await unmount();
await mount();
assert.ok(document.querySelector('.result-card'), 'surrender survives reload');
await click('成績');
assert.equal(document.querySelector('.stats-grid dd').textContent, '1');
await click('閉じる');
await click('設定');
const darkRadio =
  document.querySelector('[role="radio"][value="dark"]') ||
  document
    .querySelector('[aria-labelledby="theme-heading"]')
    .querySelectorAll('[role="radio"]')[2];
await act(async () => darkRadio.click());
assert.equal(document.documentElement.dataset.theme, 'dark');
assert.equal(localStorage.getItem('kotoba:theme'), 'dark');
await click('閉じる');
await unmount();
await mount();
assert.equal(
  document.documentElement.dataset.theme,
  'dark',
  'theme survives reload',
);
await click('設定');
let exported;
const oldURL = URL.createObjectURL.bind(URL);
const oldRevoke = URL.revokeObjectURL.bind(URL);
const anchorClick = dom.window.HTMLAnchorElement.prototype.click;
URL.createObjectURL = (blob) => {
  exported = blob;
  return 'blob:kotoba-test';
};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () {};
await click('書き出す');
const backup = JSON.parse(await exported.text());
assert.equal(backup.theme, 'dark');
assert.equal(backup.games[0].gaveUp, true);
const importFile = async (raw) => {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [{ size: raw.length, text: async () => raw }],
  });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
};
await importFile('{invalid');
assert.ok(text().includes('このファイルは読み込めません'));
await importFile(JSON.stringify(backup));
assert.ok(document.querySelector('.import-confirm'));
await click('記録を追加する');
assert.ok(text().includes('記録と設定を読み込みました'));
assert.equal(saved().gaveUp, true);
await click('閉じる');
await click('成績');
assert.equal(
  document.querySelector('.stats-grid dd').textContent,
  '1',
  'import does not double-count',
);
await click('閉じる');
await click('もう一問');
await click('答えを見る');
await click('終了して答えを見る');
assert.ok(
  document.querySelector('.result-card'),
  'practice surrender reveals answer',
);
await click('成績');
assert.equal(
  document.querySelector('.stats-grid dd').textContent,
  '1',
  'practice excluded',
);
await click('閉じる');
assert.ok(
  document.querySelector('.masthead #language-en'),
  'language switch is in the header',
);
await act(async () => document.querySelector('#language-en').click());
assert.equal(document.documentElement.lang, 'en');
assert.equal(localStorage.getItem('kotoba:language'), 'en');
await click('Settings');
assert.ok(text().includes('Settings'));
await click('Export');
assert.equal(JSON.parse(await exported.text()).language, 'en');
await click('Close');
assert.ok(text().includes('Practice'));
await click('Play again');
await type('あ');
await submit();
assert.ok(text().includes('Enter exactly four hiragana.'));
await type('shinbun');
const previousGuessCount = JSON.parse(
  localStorage.getItem('kotoba:v1:practice'),
).guesses.length;
await submit();
await settle();
const romajiRound = JSON.parse(localStorage.getItem('kotoba:v1:practice'));
assert.equal(
  romajiRound.guesses.at(-1),
  'しんぶん',
  'submit commits terminal n',
);
assert.equal(romajiRound.guesses.length, previousGuessCount + 1);
if (romajiRound.answer === 'しんぶん') await click('Play again');
await click('Give up');
assert.ok(text().includes('Give up this word?'));
await click('Keep playing');
await click('How to play');
assert.ok(text().includes('Counting kana'));
await click('Close');
await unmount();
await mount();
assert.equal(document.documentElement.lang, 'en', 'language survives reload');
await click('Practice');
const originalFour = localStorage.getItem('kotoba:v1:practice');
const chooseLength = async (n) => {
  const radio = document.querySelector(
    `[role="radio"][aria-label="${n} kana"]`,
  );
  assert.ok(radio, `length option ${n} exists`);
  await act(async () => radio.click());
};
for (const n of [3, 5, 6]) {
  await chooseLength(n);
  assert.equal(document.querySelectorAll('.board .tile').length, n * 8);
  assert.equal(document.querySelectorAll('.tile.current').length, n);
  assert.equal(localStorage.getItem('kotoba:practice-length'), String(n));
  await type('あい');
  await submit();
  assert.ok(text().includes(`Enter exactly ${n} hiragana.`));
  const key = `kotoba:v1:practice:${n}`;
  const round = JSON.parse(localStorage.getItem(key));
  assert.equal(round.guesses.length, 0);
  assert.equal(round.answer.length, n);
  await type(round.answer);
  await click('Daily');
  assert.equal(document.querySelectorAll('.board .tile').length, 32);
  absent('.length-picker');
  await click('Practice');
  assert.equal(
    document.querySelector('#guess').value,
    round.answer,
    'draft survives mode switch',
  );
  await submit();
  await chooseLength(n === 3 ? 5 : 3);
  assert.equal(
    document.querySelectorAll('.board .tile').length,
    n * 8,
    'no length changes mid-reveal',
  );
  await settle();
  assert.ok(
    document.querySelector('.result-card h2').textContent,
    'kanji reveal exists',
  );
  await click('Share result');
  assert.ok(
    document
      .querySelector('.share-preview')
      .textContent.includes(`Practice · ${n} kana`),
  );
  assert.ok(
    document
      .querySelector('.share-preview')
      .textContent.endsWith(
        'https://slowpokelu.github.io/kotoba/?w=' +
          (await import('../lib/custom.mjs')).encodeWord(round.answer),
      ),
    'a practice result links to the same word',
  );
  await click('Close');
  await waitFor(() => !document.querySelector('.share-dialog'));
  await click('Play again');
  assert.equal(document.querySelectorAll('.board .tile').length, n * 8);
  assert.notEqual(JSON.parse(localStorage.getItem(key)).answer, round.answer);
  await type('あ');
}
await chooseLength(4);
assert.equal(
  localStorage.getItem('kotoba:v1:practice'),
  originalFour,
  'old four-kana save unchanged',
);
await chooseLength(3);
assert.equal(
  document.querySelector('#guess').value,
  'あ',
  'length-specific draft restored',
);
await chooseLength(6);
await click('Settings');
await click('Export');
const multiLengthBackup = JSON.parse(await exported.text());
assert.equal(multiLengthBackup.practiceLength, 6);
for (const id of ['practice', 'practice:3', 'practice:5', 'practice:6'])
  assert.ok(
    multiLengthBackup.games.some((g) => g.id === id),
    `backup includes ${id}`,
  );
await click('Close');
await unmount();
localStorage.clear();
dom.window.history.replaceState(null, '', '/');
await mount();
assert.equal(document.documentElement.lang, 'en');
await click('Settings');
await importFile(JSON.stringify(multiLengthBackup));
await click('Merge records');
await click('Close');
await click('Practice');
assert.equal(
  document.querySelectorAll('.board .tile').length,
  48,
  'import restores length choice',
);
assert.equal(
  document.querySelector('#guess').value,
  'あ',
  'import restores practice draft',
);
await unmount();
await mount();
await click('Practice');
assert.equal(
  document.querySelectorAll('.board .tile').length,
  48,
  'length survives reload',
);
// On a touch screen, kana keys plus 決定 must not focus the field: that would
// open the phone keyboard over the kana keys.
await unmount();
localStorage.clear();
coarsePointer = true;
await mount();
const submitButton = () => document.querySelector('.submit-button');
document.body.focus();
for (const k of 'かつこう') await click(k);
assert.equal(inputField().value, 'かつこう', 'kana keys fill the draft');
await act(async () => submitButton().click());
await settle();
assert.ok(
  document.activeElement !== inputField(),
  'touch submit keeps the phone keyboard closed',
);
await act(async () => inputField().focus());
assert.ok(
  document.querySelector('.shell').classList.contains('typing'),
  'typing on a phone fits the layout above its keyboard',
);
await type('しんぶん');
await act(async () => submitButton().click());
await settle();
sameNode(
  document.activeElement,
  inputField(),
  'touch submit keeps typing focus when the field had it',
);
await act(async () => inputField().blur());
assert.ok(
  !document.querySelector('.shell').classList.contains('typing'),
  'closing the phone keyboard restores the layout',
);
coarsePointer = false;
// Near hints are off by default and locked into a round at its first guess.
await unmount();
localStorage.clear();
dom.window.history.replaceState(null, '', '/');
await mount();
const { evaluate: score } = await import('../lib/game.mjs');
const { allValid } = await import('../lib/word-pools.mjs');
absent('.legend .near-correct', 'hints are off by default');
await click('Settings');
const hintSwitch = () => document.querySelector('[role="switch"]');
assert.ok(hintSwitch(), 'settings has a hint switch');
await act(async () => hintSwitch().click());
assert.equal(localStorage.getItem('kotoba:hints'), '1');
await click('Close');
assert.ok(
  document.querySelector('.legend .near-correct'),
  'the legend explains outlines before the first guess',
);
assert.ok(
  document.querySelector('.mode-badge.hints'),
  'the board shows the hint chip',
);
const hintAnswer = saved().answer;
const hintGuess = [...allValid].find(
  (w) =>
    Array.from(w).length === 4 &&
    w !== hintAnswer &&
    score(w, hintAnswer, true).some((s) => s.startsWith('near-')),
);
assert.ok(hintGuess, 'the dictionary has a guess with a near hint');
const expected = score(hintGuess, hintAnswer, true);
const rowStatuses = () =>
  [...document.querySelectorAll('.guess-row')[0].querySelectorAll('.tile')].map(
    (tile) =>
      ['correct', 'present', 'near-correct', 'near-present', 'absent'].find(
        (s) => tile.classList.contains(s),
      ),
  );
await type(hintGuess);
await submit();
await settle();
assert.equal(saved().hints, true, 'the first guess locks hints into the round');
assert.deepEqual(rowStatuses(), expected, 'tiles show near hints');
const near = expected.findIndex((s) => s.startsWith('near-'));
assert.ok(
  document
    .querySelectorAll('.guess-row')[0]
    .querySelectorAll('.tile')
    [near].getAttribute('aria-label')
    .includes('variant'),
  'screen readers hear the near hint',
);
const nearKey = () =>
  [...document.querySelectorAll('.kana-key')].find(
    (b) => b.firstChild?.textContent === Array.from(hintGuess)[near],
  );
if (!nearKey()) await click('Voiced / small');
assert.ok(
  nearKey().classList.contains(expected[near]),
  'the tried key shows the near hint',
);
await click('Settings');
await act(async () => hintSwitch().click());
assert.equal(localStorage.getItem('kotoba:hints'), '0');
assert.ok(
  text().includes('A puzzle you have started keeps its mode'),
  'settings explain the lock',
);
await click('Close');
assert.deepEqual(rowStatuses(), expected, 'switching off keeps the round');
await unmount();
await mount();
assert.deepEqual(rowStatuses(), expected, 'the hinted round survives reload');
await click('Practice');
absent('.legend .near-correct', 'a new round follows the switched-off setting');
await type(hintGuess);
await submit();
await settle();
assert.equal(
  JSON.parse(localStorage.getItem('kotoba:v1:practice')).hints,
  undefined,
  'rounds started with hints off stay off',
);
// Hard mode: ✓ kana stay in place and ● kana are reused, from the round's
// first guess on. A rule-breaking guess is refused without using a turn.
await unmount();
localStorage.clear();
dom.window.history.replaceState(null, '', '/');
await mount();
const { hardModeError } = await import('../lib/game.mjs');
await click('Settings');
await act(async () =>
  document.querySelector('[aria-labelledby="hard-heading"]').click(),
);
assert.equal(localStorage.getItem('kotoba:hard'), '1');
await click('Close');
const hardAnswer = saved().answer;
const fours = [...allValid].filter(
  (w) => Array.from(w).length === 4 && w !== hardAnswer,
);
const opener = fours.find((w) => score(w, hardAnswer).includes('correct'));
const round1 = { answer: hardAnswer, guesses: [opener] };
const breaker = fours.find((w) => w !== opener && hardModeError(w, round1));
const keeper = fours.find((w) => w !== opener && !hardModeError(w, round1));
assert.ok(opener && breaker && keeper, 'the dictionary has test guesses');
await type(opener);
await submit();
await settle();
assert.equal(saved().hard, true, 'the first guess locks hard mode in');
assert.ok(
  document.querySelector('.mode-badge.hard'),
  'the board shows hard mode',
);
await type(breaker);
await submit();
assert.ok(
  document.querySelector('.status.error').textContent.match(/must|Use/),
  'a rule-breaking guess explains the rule',
);
assert.equal(saved().guesses.length, 1, 'a refused guess uses no turn');
await type(keeper);
await submit();
await settle();
assert.equal(saved().guesses.length, 2, 'a legal guess is accepted');
// あそび: いじわる on a 12-row board, and しりとり against the computer.
await unmount();
localStorage.clear();
dom.window.history.replaceState(null, '', '/');
await mount();
await chooseGame('Sneaky');
assert.equal(
  dom.window.location.pathname,
  '/sneaky/',
  'いじわる has its own address',
);
assert.equal(
  document.querySelectorAll('.board .guess-row').length,
  8,
  'いじわる starts with the usual eight rows',
);
await type('かいしゃ');
await submit();
await settle();
const sneaky = JSON.parse(localStorage.getItem('kotoba:v1:absurd'));
assert.deepEqual(sneaky.guesses, ['かいしゃ']);
assert.notEqual(sneaky.answer, 'かいしゃ', 'the answer dodges');
await chooseGame('Shiritori');
const { tailKana } = await import('../lib/shiritori.mjs');
const chainState = () =>
  JSON.parse(localStorage.getItem('kotoba:v1:shiritori'));
assert.equal(document.querySelectorAll('.chain-word').length, 1);
const wordFor = (start, endsInN) =>
  [...allValid].find(
    (w) =>
      Array.from(w)[0] === start &&
      (tailKana(w) === 'ん') === endsInN &&
      !chainState().chain.some((l) => l.word === w),
  );
const firstWord = chainState().chain[0].word;
const wrong = [...allValid].find(
  (w) => Array.from(w)[0] !== tailKana(firstWord) && tailKana(w) !== 'ん',
);
await type(wrong);
await submit();
assert.ok(
  document.querySelector('.status.error').textContent.includes('must start'),
  'a word with the wrong start is refused',
);
const mine = wordFor(tailKana(firstWord), false);
await type(mine);
await submit();
await act(async () => {
  await new Promise((r) => setTimeout(r, 600));
});
assert.equal(chainState().chain[1].word, mine, 'your word joins the chain');
assert.equal(chainState().chain.length, 3, 'the computer replies');
const loser = wordFor(tailKana(chainState().chain[2].word), true);
await type(loser);
await submit();
assert.equal(chainState().end, 'n', 'ending in ん loses');
assert.ok(document.querySelector('.result-card'), 'the round ends');
await unmount();
await mount();
assert.ok(
  document.querySelector('.shiritori .result-card'),
  'しりとり and its result survive a reload',
);
await click('Share result');
assert.match(
  document.querySelector('.share-preview').textContent,
  /^Kotoba · Shiritori {2}\d+ words\n/,
);
await click('Close');
await waitFor(() => !document.querySelector('.share-dialog'));
// ダブル: today's two words, the same for everyone, apart from today's ことば.
// Every guess lands on both boards; keys show both halves.
await chooseGame('Double');
assert.equal(dom.window.location.pathname, '/double/');
const doubleLib = await import('../lib/double.mjs');
const gameLib = await import('../lib/game.mjs');
const { answers: dailyWords } = await import('../lib/answers.mjs');
const dayNow = gameLib.localDay();
const doublePool = (await import('../lib/word-pools.mjs'))
  .answersFor(4)
  .map((a) => a.reading);
const todaysDouble = doubleLib.dailyAnswers(dayNow, doublePool, 2, [
  gameLib.dailyAnswer(dayNow, dailyWords).reading,
]);
assert.equal(document.querySelectorAll('.double-boards .board').length, 2);
assert.equal(
  document
    .querySelectorAll('.double-boards .board')[0]
    .querySelectorAll('.guess-row').length,
  9,
  'ダブル has nine rows',
);
localStorage.setItem('kotoba:hard', '1');
const doubleState = () =>
  JSON.parse(localStorage.getItem('kotoba:v1:double:daily:' + dayNow));
await type('かいしゃ');
await submit();
await settle();
assert.deepEqual(doubleState().guesses, ['かいしゃ']);
assert.deepEqual(doubleState().answers, todaysDouble, "today's words");
for (const board of document.querySelectorAll('.double-boards .board'))
  assert.equal(
    board.querySelectorAll('.guess-row')[0].textContent.replace(/[✓●−]/g, ''),
    'かいしゃ',
    'the guess shows on both boards',
  );
assert.ok(
  document.querySelector('.kana-key.split.tried'),
  'tried keys show both boards',
);
assert.equal(
  button('か').style.getPropertyValue('--k1').startsWith('var(--k-'),
  true,
  'each half takes its board state',
);
assert.equal(
  document.querySelectorAll('.double-boards a.guess-row').length,
  0,
  'touch keeps rows unlinked mid-game',
);
await type('しんぶん');
await submit();
await settle();
assert.equal(doubleState().guesses.length, 2, 'hard mode does not apply');
await unmount();
await mount();
assert.equal(
  document.querySelectorAll('.double-boards .guess-row .tile.filled').length,
  16,
  'ダブル survives a reload',
);
await click('Give up');
await click('Give up & reveal');
await waitFor(() => document.querySelector('.double .result-card'));
assert.equal(
  document.querySelectorAll('.double-boards a.guess-row').length,
  4,
  'finished rows link to the dictionary on both boards',
);
assert.equal(
  document.querySelectorAll('.double .dictionary-links a').length,
  2,
  'each answer links to the dictionary',
);
await click('Share result');
assert.match(
  document.querySelector('.share-preview').textContent,
  new RegExp('Double · ' + dayNow + ' {2}X/9'),
);
assert.ok(
  document
    .querySelector('.share-preview')
    .textContent.endsWith('https://slowpokelu.github.io/kotoba/double/'),
);
await click('Close');
await waitFor(() => !document.querySelector('.share-dialog'));
assert.ok(
  document.querySelector('.double .next-day'),
  'counts down to the next',
);
await click('Play again');
assert.equal(
  dom.window.location.pathname,
  '/double/practice/',
  'then on to practice',
);
assert.equal(
  document.querySelectorAll('.double-boards .tile.filled').length,
  0,
  'practice has its own round',
);
await click('Daily');
assert.ok(doubleState().gaveUp, "today's round stays finished");
// トリプル: three boards with their own save; keys in thirds.
await click('Practice');
await chooseGame('Triple');
assert.equal(
  dom.window.location.pathname,
  '/triple/',
  "a game opens on today's puzzle",
);
await click('Practice');
assert.equal(document.querySelectorAll('.double-boards .board').length, 3);
assert.equal(
  document
    .querySelectorAll('.double-boards .board')[0]
    .querySelectorAll('.guess-row').length,
  10,
  'トリプル has ten rows',
);
await type('かいしゃ');
await submit();
await settle();
const tripleState = JSON.parse(localStorage.getItem('kotoba:v1:triple'));
assert.equal(tripleState.answers.length, 3);
assert.deepEqual(tripleState.guesses, ['かいしゃ']);
assert.ok(document.querySelector('.kana-key.split.thirds.tried'));
await click('Daily');
const tripleToday = JSON.parse(
  localStorage.getItem('kotoba:v1:triple:daily:' + dayNow) ?? 'null',
);
assert.ok(
  !tripleToday || tripleToday.answers.every((a) => !todaysDouble.includes(a)),
  "today's トリプル shares no word with today's ダブル",
);
await act(async () => document.querySelector('.game-switch').click());
assert.ok(
  document.querySelector('.game-list a[href="/double/"] svg'),
  "the menu marks today's finished ダブル",
);
await act(async () => document.querySelector('.game-switch').click());
// かなビー: today's seven kana; common words only, the centre always used.
await chooseGame('Kana bee');
const beeLib = await import('../lib/bee.mjs');
const { commonWords } = await import('../lib/word-pools.mjs');
const { localDay: today } = await import('../lib/game.mjs');
const beePuzzle = beeLib.beePuzzle(today(), beeLib.beeWords(commonWords));
assert.equal(document.querySelectorAll('.honeycomb .cell').length, 7);
assert.equal(
  document.querySelector('.honeycomb .cell.center').textContent,
  beePuzzle.center,
);
await type(beePuzzle.outer.slice(0, 3).join(''));
await submit();
assert.ok(
  document.querySelector('.status.error').textContent.includes('centre'),
  'a word without the centre kana is refused',
);
await type(beePuzzle.answers[0]);
await submit();
const beeState = () =>
  JSON.parse(localStorage.getItem('kotoba:v1:bee:' + today()));
assert.deepEqual(beeState().found, [beePuzzle.answers[0]]);
assert.equal(document.querySelectorAll('.bee-found li').length, 1);
await type('');
await act(async () =>
  document.querySelector('.honeycomb .cell.center').click(),
);
assert.equal(
  document.querySelector('#guess').value,
  beePuzzle.center,
  'tapping a cell types its kana',
);
await unmount();
await mount();
assert.equal(
  document.querySelectorAll('.bee-found li').length,
  1,
  'found words survive a reload',
);
// 和同開珎: one kanji per guess; a reading in kana lists kanji to pick.
await chooseGame('Kanji cross');
assert.equal(dom.window.location.pathname, '/wadou/');
await waitFor(() => document.querySelector('.wadou-clue'));
const wadouLib = await import('../lib/wadou.mjs');
const wadouData = await import('../lib/wadou-data.mjs');
const todayCross =
  wadouData.puzzles[wadouLib.dailyIndex(dayNow, wadouData.puzzles.length)];
assert.deepEqual(
  [...document.querySelectorAll('.wadou-clue')].map((c) => c.textContent),
  todayCross.k.map((k) => Array.from(k)[0]),
  "today's clues",
);
await type('ほん');
const pick = [...document.querySelectorAll('.kanji-candidates button')].find(
  (b) => b.textContent !== todayCross.c,
);
assert.ok(pick, 'a reading lists kanji');
await act(async () => pick.click());
assert.equal(document.querySelector('#guess').value, pick.textContent);
assert.equal(
  document.querySelector('.wadou-centre').textContent,
  pick.textContent,
  'the centre previews a picked kanji',
);
await submit();
assert.equal(document.querySelectorAll('.wadou-guess:not(:empty)').length, 1);
await type('日本');
await submit();
assert.ok(text().includes('Answer with one kanji.'));
await type(todayCross.c);
await submit();
await waitFor(() => document.querySelector('.wadou .result-card'));
assert.equal(document.querySelectorAll('.wadou-words li').length, 4);
await click('Share result');
assert.match(
  document.querySelector('.share-preview').textContent,
  /^Kotoba · Kanji cross · [\d-]+ {2}2\/5\n/,
);
await click('Close');
await waitFor(() => !document.querySelector('.share-dialog'));
// ことばのはしご: one kana per rung, with undo, to today's goal.
await chooseGame('Word ladder');
assert.equal(dom.window.location.pathname, '/ladder/');
const ladderLib = await import('../lib/ladder.mjs');
const pools = await import('../lib/word-pools.mjs');
const isThree = (w) => Array.from(w).length === 3;
const ladderGraph = ladderLib.ladderGraph(
  Object.keys(pools.commonWords).filter(isThree),
);
// The par counts every word a rung may be, common ones first.
const anyRung = ladderLib.ladderGraph([
  ...Object.keys(pools.commonWords).filter(isThree),
  ...[...pools.wordValid].filter(
    (w) => isThree(w) && !(w in pools.commonWords),
  ),
]);
const todayLadder = ladderLib.makeLadder(
  pools
    .answersFor(3)
    .map((a) => a.reading)
    .filter((w) => w in pools.commonWords),
  ladderGraph,
  ladderLib.seeded('ladder:' + dayNow),
  anyRung,
);
const climb = ladderLib.shortestPath(
  todayLadder.start,
  todayLadder.goal,
  anyRung,
);
assert.ok(climb.length - 1 <= todayLadder.par, 'rare words can beat par');
assert.equal(
  document.querySelector('.ladder-rung.start').getAttribute('aria-label'),
  'Start: ' + todayLadder.start,
);
await type(climb[2]);
await submit();
assert.ok(text().includes('Change exactly one kana of the last word.'));
await type(climb[1]);
await submit();
assert.equal(document.querySelectorAll('.ladder-rung').length, 4);
await click('Undo');
assert.equal(
  document.querySelectorAll('.ladder-rung').length,
  3,
  'undo takes the rung back',
);
for (const word of climb.slice(1)) {
  await type(word);
  await submit();
}
await waitFor(() => document.querySelector('.ladder .result-card'));
assert.match(
  text(),
  /under par!|right on par!/,
  'beating or matching par earns praise',
);
assert.deepEqual(
  [...document.querySelectorAll('.ladder a.ladder-row')].map((a) =>
    decodeURIComponent(a.href.replace('https://jisho.org/search/', '')),
  ),
  climb.map((w) => pools.commonWords[w] ?? w),
  'every rung links to the dictionary once the ladder is done',
);
assert.equal(
  document.querySelectorAll('.ladder-path a').length,
  todayLadder.par + 1,
  'so does the par ladder',
);
// 問題を作る: by default an everyday word nobody sees, the same for everyone
// who opens the link, the sender included.
const { encodeWord, decodeWord } = await import('../lib/custom.mjs');
await act(async () => document.querySelector('.game-switch').click());
await act(async () => document.querySelector('.game-create').click());
const randomInvite = document.querySelector('.share-preview').textContent;
const randomCode = randomInvite.split('?w=')[1];
const hiddenWord = decodeWord(randomCode);
assert.ok(
  pools.answersFor(4).some((a) => a.reading === hiddenWord),
  'an everyday four-kana word',
);
assert.ok(!text().includes(hiddenWord), 'nobody sees the word');
await click('Play it too');
assert.equal(dom.window.location.search, '?w=' + randomCode);
assert.equal(
  document.querySelector('.board-column .game-heading h2').textContent,
  "A friend's puzzle",
);
assert.equal(
  document.querySelector('.board .guess-row').querySelectorAll('.tile').length,
  4,
);
// Or the sender picks the word.
await act(async () => document.querySelector('.game-switch').click());
await act(async () => document.querySelector('.game-create').click());
await click('Choose the word myself');
const customField = document.querySelector('#custom-word');
await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
    customField,
    'がっこう',
  );
  customField.dispatchEvent(new Event('input', { bubbles: true }));
});
const customCode = encodeWord('がっこう');
assert.ok(
  document
    .querySelector('.share-preview')
    .textContent.endsWith('/?w=' + customCode),
  'the invite carries the link',
);
assert.ok(
  !document.querySelector('.share-preview').textContent.includes('がっこう'),
  'the invite does not give the word away',
);
await click('Close');
await unmount();
dom.window.history.replaceState(null, '', '/?w=' + customCode);
await mount();
assert.equal(
  document.querySelector('.board-column .game-heading h2').textContent,
  "A friend's puzzle",
);
await type('がっこう');
await submit();
await settle();
assert.ok(document.querySelector('.result-card'), "the friend's word wins");
assert.ok(localStorage.getItem('kotoba:v1:custom:' + customCode));
// ふたりでしりとり: the prompt, then player 1 and player 2 in turn.
await chooseGame('Shiritori');
await click('Two players');
const duoState = () =>
  JSON.parse(localStorage.getItem('kotoba:v1:shiritori:duo'));
const duoWord = (start, endsInN) =>
  [...allValid].find(
    (w) =>
      Array.from(w)[0] === start &&
      Array.from(w).length > 1 &&
      (tailKana(w) === 'ん') === endsInN &&
      !duoState().chain.some((l) => l.word === w),
  );
const firstDuo = duoWord(tailKana(duoState().chain[0].word), false);
await type(firstDuo);
await submit();
assert.equal(duoState().chain[1].by, 'p1');
assert.equal(
  document.querySelector('.next-kana .turn').textContent,
  'Player 2',
);
await type(duoWord(tailKana(firstDuo), true));
await submit();
assert.equal(duoState().end, 'n');
assert.ok(text().includes('Player 1 wins'), 'ending in ん loses for player 2');
await click('Computer');
assert.ok(
  document.querySelector('.shiritori .result-card'),
  'the computer round keeps its own state',
);
await unmount();
URL.createObjectURL = oldURL;
URL.revokeObjectURL = oldRevoke;
dom.window.HTMLAnchorElement.prototype.click = anchorClick;
console.log(
  'UI flows passed: typing, invalid/repeated guesses, kana modifiers, erase, help, tabs, draft recovery, win, loss, replay, clipboard fallback.',
);
window.close();
