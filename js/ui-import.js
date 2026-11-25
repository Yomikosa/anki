/**
 * 「公式を追加（JSON取込）」画面コントローラー
 * - プロンプト全文はDADSディスクロージャーに収納し、コピーボタンとJSON貼り付け欄をひと目で見渡せる構成へ整理
 */

import { GEMINI_IMPORT_PROMPT } from './prompt-template.js';
import { SAMPLE_IMPORT_JSON } from './presets.js';
import { validateImportJson } from './validator.js';
import { validateLatexWithKatex } from './katex-renderer.js';
import {
  ICONS,
  copyToClipboard,
  createNotificationBanner,
  escapeHtml,
} from './ui-helpers.js';

export class ImportView {
  /**
   * @param {HTMLElement} root
   * @param {import('./store.js').FormulaStore} store
   * @param {{ onImportedAndStudy: (firstCardId: string) => void, announce: (msg: string) => void }} callbacks
   */
  constructor(root, store, callbacks) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;
    this.copyTimer = null;

    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="import-layout">
        <!-- STEP 1: Geminiプロンプトコピー -->
        <section class="import-section glass-panel" aria-labelledby="step1-heading">
          <div class="step-header">
            <span class="step-badge" aria-hidden="true">STEP 1</span>
            <div class="step-header__text">
              <h2 id="step1-heading" class="dads-heading-sm">Gemini 用プロンプトをコピー</h2>
              <p class="dads-support-text">
                参考書の写真と一緒に Gemini へ貼り付けて送信します（穴埋め <code>{{ }}</code> と LaTeX エスケープの指示込み）。
              </p>
            </div>
          </div>

          <div class="import-actions">
            <button type="button" id="copy-prompt-btn" class="dads-button" data-type="solid-fill" data-size="md">
              ${ICONS.copy}
              <span>プロンプトをコピー</span>
            </button>
          </div>

          <div id="copy-feedback-slot" class="banner-slot" aria-live="polite"></div>

          <details class="dads-disclosure dads-disclosure--inline">
            <summary class="dads-disclosure__summary">プロンプト全文を確認する</summary>
            <div class="dads-disclosure__body">
              <label for="gemini-prompt-preview" class="sr-only">Gemini 送信用の指示文プレビュー</label>
              <textarea
                id="gemini-prompt-preview"
                class="dads-textarea dads-textarea--mono"
                rows="9"
                readonly
              >${escapeHtml(GEMINI_IMPORT_PROMPT)}</textarea>
            </div>
          </details>
        </section>

        <!-- STEP 2: JSON貼り付け＆インポート -->
        <section class="import-section glass-panel" aria-labelledby="step2-heading">
          <div class="step-header">
            <span class="step-badge" aria-hidden="true">STEP 2</span>
            <div class="step-header__text">
              <h2 id="step2-heading" class="dads-heading-sm">出力された JSON を貼り付けて取込</h2>
              <p class="dads-support-text">
                <code>\`\`\`json ... \`\`\`</code> が付いていても自動で除去します。
              </p>
            </div>
          </div>

          <div class="dads-form-field">
            <label for="json-import-input" class="dads-form-label">
              公式 JSON データ
              <span class="dads-requirement-tag">必須</span>
            </label>
            <textarea
              id="json-import-input"
              class="dads-textarea dads-textarea--mono"
              rows="8"
              spellcheck="false"
              placeholder='[{"subject": "数学", "title": "二次方程式の解の公式", "formula": "{{x}} = \\\\frac{{-b \\\\pm \\\\sqrt{b^2 - 4ac}}}{{2a}}"}]'
              aria-invalid="false"
            ></textarea>
          </div>

          <div class="import-actions">
            <button type="button" id="run-import-btn" class="dads-button" data-type="solid-fill" data-size="md">
              ${ICONS.plus}
              <span>インポートして追加</span>
            </button>
            <button type="button" id="insert-sample-json-btn" class="dads-button" data-type="outline" data-size="md">
              ${ICONS.sparkle}
              <span>サンプルを試す</span>
            </button>
            <button type="button" id="clear-json-btn" class="dads-button" data-type="text" data-size="sm">
              <span>クリア</span>
            </button>
          </div>

          <div id="import-feedback-slot" class="banner-slot"></div>
        </section>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const copyBtn = this.root.querySelector('#copy-prompt-btn');
    const copyFeedback = this.root.querySelector('#copy-feedback-slot');
    const jsonInput = this.root.querySelector('#json-import-input');
    const importBtn = this.root.querySelector('#run-import-btn');
    const sampleBtn = this.root.querySelector('#insert-sample-json-btn');
    const clearBtn = this.root.querySelector('#clear-json-btn');
    const importFeedback = this.root.querySelector('#import-feedback-slot');

    copyBtn?.addEventListener('click', async () => {
      const ok = await copyToClipboard(GEMINI_IMPORT_PROMPT);
      copyFeedback.innerHTML = '';

      if (ok) {
        copyBtn.innerHTML = `${ICONS.check}<span>コピーしました</span>`;
        if (this.copyTimer) clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => {
          copyBtn.innerHTML = `${ICONS.copy}<span>プロンプトをコピー</span>`;
        }, 2500);

        copyFeedback.appendChild(
          createNotificationBanner({
            type: 'success',
            heading: 'プロンプトをコピーしました',
            messages: 'Gemini に参考書の画像を添付し、そのまま貼り付けて送信してください。',
            dismissible: true,
          })
        );
        this.callbacks.announce('プロンプトをコピーしました。');
      } else {
        copyFeedback.appendChild(
          createNotificationBanner({
            type: 'warning',
            heading: '自動コピーに失敗しました',
            messages: '「プロンプト全文を確認する」を開いて手動でコピーしてください。',
            dismissible: true,
          })
        );
      }
    });

    sampleBtn?.addEventListener('click', () => {
      jsonInput.value = SAMPLE_IMPORT_JSON;
      jsonInput.setAttribute('aria-invalid', 'false');
      importFeedback.innerHTML = '';
      importFeedback.appendChild(
        createNotificationBanner({
          type: 'info',
          heading: 'サンプルJSON（余弦定理・運動エネルギー）を入力しました',
          messages: '「インポートして追加」を押すと登録されます。',
          dismissible: true,
        })
      );
      jsonInput.focus();
    });

    clearBtn?.addEventListener('click', () => {
      jsonInput.value = '';
      jsonInput.setAttribute('aria-invalid', 'false');
      importFeedback.innerHTML = '';
      jsonInput.focus();
    });

    jsonInput?.addEventListener('input', () => {
      if (jsonInput.getAttribute('aria-invalid') === 'true') {
        jsonInput.setAttribute('aria-invalid', 'false');
      }
    });

    importBtn?.addEventListener('click', () => {
      importFeedback.innerHTML = '';
      const result = validateImportJson(jsonInput.value, {
        validateKatex: validateLatexWithKatex,
      });

      if (!result.ok) {
        jsonInput.setAttribute('aria-invalid', 'true');
        importFeedback.appendChild(
          createNotificationBanner({
            type: 'error',
            heading: `JSONの検証エラー（${result.errors.length}件）`,
            messages: result.errors,
            dismissible: true,
          })
        );
        this.callbacks.announce(`インポートエラーが${result.errors.length}件あります。`);
        return;
      }

      const added = this.store.addMany(result.cards);
      jsonInput.setAttribute('aria-invalid', 'false');
      jsonInput.value = '';

      const firstId = added[0]?.id;
      const summaryMessages = [
        `${added.length}件を保存しました（${added.map((c) => c.title).join('、')}）。`,
        ...result.warnings,
      ];

      importFeedback.appendChild(
        createNotificationBanner({
          type: 'success',
          heading: `${added.length}件の公式を追加しました`,
          messages: summaryMessages,
          actions: firstId
            ? [
                {
                  label: '追加した公式を学習する',
                  variant: 'solid-fill',
                  onClick: () => this.callbacks.onImportedAndStudy(firstId),
                },
              ]
            : [],
          dismissible: true,
        })
      );
      this.callbacks.announce(`${added.length}件の公式を追加しました。`);
    });
  }
}
