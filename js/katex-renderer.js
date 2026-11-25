/**
 * KaTeX 描画＆スタサプ風穴埋めインタラクション制御モジュール
 */

import {
  buildKatexWithCloze,
  parseRichTextWithCloze,
  stripClozeMarkers,
} from './cloze.js';

/**
 * KaTeX trust 許可関数（安全な \htmlClass と \htmlData のみ許可）
 * @param {{ command?: string }} context
 * @returns {boolean}
 */
function isTrustedCommand(context) {
  return context?.command === '\\htmlClass' || context?.command === '\\htmlData';
}

/**
 * KaTeX で構文検証のみ実行（インポート時ドライラン用）
 * @param {string} latex
 */
export function validateLatexWithKatex(latex) {
  if (typeof window === 'undefined' || !window.katex) return;
  window.katex.renderToString(latex, {
    displayMode: true,
    throwOnError: true,
    strict: false,
    trust: false,
  });
}

/**
 * 単一の KaTeX 数式を指定要素へ描画し、穴埋めスロットに操作イベントとWAI-ARIA属性を付与する
 *
 * @param {HTMLElement} container
 * @param {string} rawFormula
 * @param {Object} options
 * @param {boolean} [options.displayMode=true]
 * @param {'cloze'|'full'|'preview'} [options.mode='cloze']
 * @param {Set<number>} [options.revealedSet]
 * @param {number} [options.startSlotIndex=0]
 * @param {number|null} [options.justToggledSlot=null]
 * @param {(slotIndex: number, viaKeyboard: boolean) => void} [options.onToggleSlot]
 * @returns {{ slotCount: number, nextSlotIndex: number }}
 */
export function renderKatexFormula(container, rawFormula, options = {}) {
  const {
    displayMode = true,
    mode = 'cloze',
    revealedSet = new Set(),
    startSlotIndex = 0,
    justToggledSlot = null,
    onToggleSlot = null,
  } = options;

  container.innerHTML = '';

  const built = buildKatexWithCloze(rawFormula, {
    mode,
    revealedSet,
    startSlotIndex,
  });

  if (typeof window === 'undefined' || !window.katex) {
    // KaTeX CDN 読み込み前の安全なフォールバック
    const code = document.createElement('code');
    code.className = 'katex-fallback-code';
    code.textContent = stripClozeMarkers(rawFormula);
    container.appendChild(code);
    return { slotCount: built.slotCount, nextSlotIndex: built.nextSlotIndex };
  }

  try {
    window.katex.render(built.latex, container, {
      displayMode,
      throwOnError: true,
      strict: false,
      trust: isTrustedCommand,
    });
  } catch (err) {
    // 万一穴埋め描画でエラーが出た場合、素のLaTeXで安全にフォールバック表示
    try {
      window.katex.render(stripClozeMarkers(rawFormula), container, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      const errBox = document.createElement('div');
      errBox.className = 'katex-error-fallback';
      errBox.textContent = `数式の描画エラー: ${err?.message || rawFormula}`;
      container.appendChild(errBox);
    }
    return { slotCount: built.slotCount, nextSlotIndex: built.nextSlotIndex };
  }

  if (mode === 'cloze' && typeof onToggleSlot === 'function') {
    const slotElements = container.querySelectorAll('[data-cloze-id]');
    slotElements.forEach((el) => {
      const slotIndex = Number(el.getAttribute('data-cloze-id'));
      const isRevealed = el.getAttribute('data-cloze-state') === 'revealed';
      const displayNum = slotIndex + 1;

      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-expanded', isRevealed ? 'true' : 'false');
      el.setAttribute(
        'aria-label',
        isRevealed
          ? `穴埋め ${displayNum}（表示中・タップで隠す）`
          : `穴埋め ${displayNum}（隠れています・タップで表示）`
      );

      if (justToggledSlot === slotIndex) {
        el.classList.add('is-just-toggled');
      }

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onToggleSlot(slotIndex, false);
      });

      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onToggleSlot(slotIndex, true);
        }
      });
    });
  }

  return { slotCount: built.slotCount, nextSlotIndex: built.nextSlotIndex };
}

/**
 * 解説文（日本語テキスト + インライン数式 $...$ + テキスト穴埋め {{...}}）を描画する
 *
 * @param {HTMLElement} container
 * @param {string} rawText
 * @param {Object} options
 * @param {'cloze'|'full'|'preview'} [options.mode='cloze']
 * @param {Set<number>} [options.revealedSet]
 * @param {number} [options.startSlotIndex=0]
 * @param {number|null} [options.justToggledSlot=null]
 * @param {(slotIndex: number, viaKeyboard: boolean) => void} [options.onToggleSlot]
 * @returns {{ totalSlots: number, nextSlotIndex: number }}
 */
export function renderRichTextExplanation(container, rawText, options = {}) {
  const {
    mode = 'cloze',
    revealedSet = new Set(),
    startSlotIndex = 0,
    justToggledSlot = null,
    onToggleSlot = null,
  } = options;

  container.innerHTML = '';
  const parsed = parseRichTextWithCloze(rawText, startSlotIndex);
  const fragment = document.createDocumentFragment();

  for (const segment of parsed.segments) {
    if (segment.type === 'text') {
      for (const token of segment.tokens) {
        if (token.type === 'raw') {
          // 改行を <br> に変換しつつ安全にテキストノード追加
          const lines = token.value.split(/\r?\n/);
          lines.forEach((line, idx) => {
            if (idx > 0) fragment.appendChild(document.createElement('br'));
            if (line) fragment.appendChild(document.createTextNode(line));
          });
        } else if (token.type === 'cloze') {
          if (mode === 'full') {
            const strong = document.createElement('strong');
            strong.className = 'explanation-highlight';
            strong.textContent = token.content;
            fragment.appendChild(strong);
          } else if (mode === 'preview') {
            const chip = document.createElement('span');
            chip.className = 'cloze-preview-chip cloze-preview-chip--text';
            chip.textContent = token.content;
            fragment.appendChild(chip);
          } else {
            const isRevealed = revealedSet.has(token.index);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `cloze-text-btn ${isRevealed ? 'cloze-text-btn--revealed' : 'cloze-text-btn--hidden'}`;
            btn.dataset.clozeId = String(token.index);
            btn.dataset.clozeState = isRevealed ? 'revealed' : 'hidden';
            btn.setAttribute('aria-expanded', isRevealed ? 'true' : 'false');
            btn.setAttribute(
              'aria-label',
              isRevealed
                ? `穴埋め ${token.index + 1}（${token.content}・タップで隠す）`
                : `穴埋め ${token.index + 1}（隠れています・タップで表示）`
            );
            btn.textContent = isRevealed ? token.content : ' ? ';

            if (justToggledSlot === token.index) {
              btn.classList.add('is-just-toggled');
            }

            if (typeof onToggleSlot === 'function') {
              btn.addEventListener('click', (event) => {
                // detail === 0 はキーボード（Enter/Space）によるクリック発火
                const viaKeyboard = event.detail === 0;
                onToggleSlot(token.index, viaKeyboard);
              });
            }
            fragment.appendChild(btn);
          }
        }
      }
    } else if (segment.type === 'math') {
      const mathWrap = document.createElement(segment.display ? 'div' : 'span');
      mathWrap.className = segment.display ? 'explanation-math-block' : 'explanation-math-inline';
      renderKatexFormula(mathWrap, segment.rawLatex, {
        displayMode: segment.display,
        mode,
        revealedSet,
        startSlotIndex: segment.startSlotIndex,
        justToggledSlot,
        onToggleSlot,
      });
      fragment.appendChild(mathWrap);
    }
  }

  container.appendChild(fragment);
  return {
    totalSlots: parsed.totalSlots,
    nextSlotIndex: parsed.nextSlotIndex,
  };
}
