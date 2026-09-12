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
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
HTMLElement.prototype.scrollIntoView = function () {};
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
  [...document.querySelectorAll('button')].find(
    (b) =>
      b.textContent.trim() === label ||
      b.getAttribute('aria-label') === label ||
      b.getAttribute('aria-label')?.startsWith(label + '、'),
  );
const click = async (label) => {
  const b = button(label);
  assert.ok(b, 'button exists: ' + label);
  await act(async () => {
    b.click();
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

await mount();
assert.equal(document.documentElement.lang, 'en', 'English is the default');
assert.equal(document.querySelector('#language-en').textContent.trim(), 'en');
assert.equal(document.querySelector('#language-ja').textContent.trim(), 'jp');
assert.ok(document.querySelector('#language-en u'));
assert.equal(document.querySelector('#language-ja u'), null);
await click('日本語');
assert.ok(document.querySelector('#language-ja u'));
assert.equal(document.querySelector('#language-en u'), null);
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
assert.equal(
  document.activeElement,
  inputField(),
  'conversion preserves focus',
);
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
for (const letter of 'konnichiha') await type(inputField().value + letter);
assert.equal(inputField().value, 'こんにちは', 'double n works incrementally');
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
assert.equal(document.activeElement, guessField, 'submission preserves focus');
assert.equal(guessField.disabled, false, 'reveal must not disable the input');
assert.equal(guessField.readOnly, true, 'reveal temporarily locks editing');
await submit();
await settle();
assert.equal(document.activeElement, guessField, 'focus survives the reveal');
assert.equal(guessField.readOnly, false, 'typing resumes after the reveal');
assert.equal(saved().guesses[0], 'がっこう');
await type('がっこう');
button('回答する').focus();
await submit();
assert.equal(
  document.activeElement,
  guessField,
  'button submission returns focus even for errors',
);
assert.ok(text().includes('その言葉はもう試しました'));
assert.equal(saved().guesses.length, 1);
await type('ひま');
await unmount();
await mount();
assert.equal(document.querySelector('#guess').value, 'ひま');
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
await click('結果をシェア');
assert.ok(document.querySelector('.share-card'), 'share preview opens');
assert.ok(
  !document.querySelector('.share-card').textContent.includes(saved().answer),
  'share card has no answer',
);
await click('結果をコピー');
assert.ok(document.querySelector('.share-fallback'), 'copy fallback appears');
assert.ok(
  document
    .querySelector('.share-fallback')
    .value.endsWith('https://slowpokelu.github.io/kotoba/'),
  'Japanese copy fallback includes the public game link',
);
await click('閉じる');
let nativeResult;
Object.defineProperty(navigator, 'share', {
  configurable: true,
  writable: true,
  value: async (data) => {
    nativeResult = data;
  },
});
await click('結果をシェア');
await click('シェア…');
assert.ok(nativeResult.text.endsWith('https://slowpokelu.github.io/kotoba/'));
assert.ok(
  !nativeResult.text.includes(saved().answer),
  'native share contains no answer',
);
navigator.share = async () => {
  throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
};
await click('シェア…');
assert.equal(
  document.querySelector('.share-notice'),
  null,
  'cancelling share is silent',
);
navigator.share = async () => {
  throw new Error('blocked');
};
await click('シェア…');
assert.ok(
  document.querySelector('.share-fallback'),
  'failed native share leaves manual copy available',
);
let copiedResult;
navigator.clipboard.writeText = async (value) => {
  copiedResult = value;
};
await click('結果をコピー');
assert.equal(copiedResult, nativeResult.text);
assert.equal(document.querySelector('.share-fallback'), null);

const canvasPrototype = dom.window.HTMLCanvasElement.prototype;
const originalGetContext = canvasPrototype.getContext;
const originalToBlob = canvasPrototype.toBlob;
const originalImageUrl = URL.createObjectURL.bind(URL);
const originalImageClick = dom.window.HTMLAnchorElement.prototype.click;
let downloadedImage;
const drawnText = [];
canvasPrototype.getContext = () => ({
  fillRect() {},
  fillText(value) {
    drawnText.push(value);
  },
});
canvasPrototype.toBlob = (callback, type) =>
  callback(new Blob(['image-test'], { type }));
URL.createObjectURL = (blob) => {
  assert.equal(blob.type, 'image/png');
  return 'blob:share-test';
};
dom.window.HTMLAnchorElement.prototype.click = function () {
  downloadedImage = this.download;
};
await click('画像を保存');
assert.match(downloadedImage, /^kotoba-.+\.png$/);
assert.ok(drawnText.includes('slowpokelu.github.io/kotoba/'));
assert.ok(
  !drawnText.includes(saved().answer),
  'image drawing contains no answer',
);
canvasPrototype.getContext = originalGetContext;
canvasPrototype.toBlob = originalToBlob;
URL.createObjectURL = originalImageUrl;
dom.window.HTMLAnchorElement.prototype.click = originalImageClick;
navigator.clipboard.writeText = async () => {
  throw new Error('denied');
};
delete navigator.share;
await click('閉じる');
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
assert.equal(
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
  assert.equal(document.querySelector('.length-picker'), null);
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
  await click('Copy result');
  assert.ok(
    document
      .querySelector('.share-fallback')
      .value.includes(`Practice · ${n} kana`),
  );
  assert.ok(
    document
      .querySelector('.share-fallback')
      .value.endsWith('https://slowpokelu.github.io/kotoba/'),
    'English practice result includes the public game link',
  );
  await click('Close');
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
await unmount();
URL.createObjectURL = oldURL;
URL.revokeObjectURL = oldRevoke;
dom.window.HTMLAnchorElement.prototype.click = anchorClick;
console.log(
  'UI flows passed: typing, invalid/repeated guesses, kana modifiers, erase, help, tabs, draft recovery, win, loss, replay, clipboard fallback.',
);
window.close();
