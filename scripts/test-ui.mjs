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
const type = async (value) => {
  const input = document.querySelector('#guess');
  assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(input, value);
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
assert.equal(document.querySelectorAll('.board .tile').length, 32);
assert.equal(document.querySelectorAll('.guess-row .current').length, 4);
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
assert.ok(text().includes('もう一問、気軽に。'));
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
assert.ok(text().includes('見つけた！'));
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
await click('結果をコピー');
assert.ok(document.querySelector('.share-fallback'), 'copy fallback appears');
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
await click('答えを見る');
assert.ok(document.querySelector('[role="alertdialog"]'));
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
await click('設定');
await act(async () => document.querySelector('#language-en').click());
assert.equal(document.documentElement.lang, 'en');
assert.equal(localStorage.getItem('kotoba:language'), 'en');
assert.ok(text().includes('Settings'));
await click('Export');
assert.equal(JSON.parse(await exported.text()).language, 'en');
await click('Close');
assert.ok(text().includes('Practice'));
await click('Play again');
await type('あ');
await submit();
assert.ok(text().includes('Enter exactly four hiragana.'));
await click('Give up');
assert.ok(text().includes('Give up this word?'));
await click('Keep playing');
await click('How to play');
assert.ok(text().includes('Counting kana'));
await click('Close');
await unmount();
await mount();
assert.equal(document.documentElement.lang, 'en', 'language survives reload');
await unmount();
URL.createObjectURL = oldURL;
URL.revokeObjectURL = oldRevoke;
dom.window.HTMLAnchorElement.prototype.click = anchorClick;
console.log(
  'UI flows passed: typing, invalid/repeated guesses, kana modifiers, erase, help, tabs, draft recovery, win, loss, replay, clipboard fallback.',
);
window.close();
