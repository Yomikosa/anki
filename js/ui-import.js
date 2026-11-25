/**
 * 「公式を追加（JSON取込）」タブ コントローラー
 * - Gemini連携用プロンプトのプレビュー＆ワンクリックコピー
 * - JSON貼り付けインポート＆DADSノティフィケーションバナーによるバリデーション表示
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
        <!-- ステップ1: Geminiプロンプトコピー -->
        <section class="import-section glass-panel" aria-labelledby="step1-heading">
          <div class="step-header">
            <span class="step-badge" aria-hidden="true">STEP 1</span>
            <div>
              <h2 id="step1-heading" class="dads-heading-md">AI読み取り用プロンプトをコピー</h2>
              <p class="dads-support-text">
                お使いの Gemini（Web / アプリ）に参考書・ノートの写真と一緒に以下のプロンプトを貼り付けて送信すると、穴埋め（<code>{{ }}</code>）対応済みの JSON が出力されます。APIキーは不要です。
              </p>
            </div>
          </div>

          <div class="dads-form-field">
            <label for="gemini-prompt-preview" class="dads-form-label">
              Gemini 送信用の指示文（プレビュー・読み取り専用）
            </label>
            <textarea
              id="gemini-prompt-preview"
              class="dads-textarea dads-textarea--mono"
              rows="10"
              readonly
              aria-describedby="gemini-prompt-help"
            >${escapeHtml(GEMINI_IMPORT_PROMPT)}</textarea>
            <p id="gemini-prompt-help" class="dads-support-text">
              LaTeX のバックスラッシュ二重エスケープ規則と穴埋め記法 <code>{{ }}</code> の指示が含まれています。
            </p>
          </div>

          <div class="import-actions">
            <button type="button" id="copy-prompt-btn" class="dads-button" data-type="solid-fill" data-size="md">
              ${ICONS.copy}
              <span>プロンプトをコピー</span>
            </button>
          </div>

          <div id="copy-feedback-slot" class="banner-slot" aria-live="polite"></div>
        </section>

        <!-- ステップ2: JSON貼り付け＆インポート -->
        <section class="import-section glass-panel" aria-labelledby="step2-heading">
          <div class="step-header">
            <span class="step-badge" aria-hidden="true">STEP 2</span>
            <div>
              <h2 id="step2-heading" class="dads-heading-md">出力された JSON を貼り付けてインポート</h2>
              <p class="dads-support-text">
                Gemini が出力した JSON 配列をそのまま貼り付けてください。<code>\`\`\`json ... \`\`\`</code> のコードブロック記号が含まれていても自動で取り除きます。
              </p>
            </div>
          </div>

          <div class="dads-form-field">
            <label for="json-import-input" class="dads-form-label">
              公式データ（JSON配列）
              <span class="dads-requirement-tag">必須</span>
            </label>
            <p id="json-import-help" class="dads-support-text">
              必須キー：<code>title</code>（公式名）、<code>formula</code>（LaTeX数式）。任意キー：<code>subject</code>、<code>category</code>、<code>question</code>、<code>explanation</code>
            </p>
            <textarea
              id="json-import-input"
              class="dads-textarea dads-textarea--mono"
              rows="11"
              spellcheck="false"
              placeholder='[&#10;  {&#10;    "subject": "数学",&#10;    "title": "二次方程式の解の公式",&#10;    "formula": "{{x}} = \\\\frac{{-b \\\\pm \\\\sqrt{b^2 - 4ac}}}{{2a}}",&#10;    "explanation": "判別式 $D = {{b^2 - 4ac}}$ で実数解の個数が決まる。"&#10;  }&#10;]'
              aria-describedby="json-import-help"
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
              <span>サンプルJSONを入力</span>
            </button>
            <button type="button" id="clear-json-btn" class="dads-button" data-type="text" data-size="md">
              <span>入力をクリア</span>
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
            heading: 'AI読み取り用プロンプトをクリップボードにコピーしました',
            messages: 'Gemini の入力欄に参考書の画像を添付し、そのまま貼り付けて送信してください。',
            dismissible: true,
          })
        );
        this.callbacks.announce('プロンプトをクリップボードにコピーしました。');
      } else {
        copyFeedback.appendChild(
          createNotificationBanner({
            type: 'warning',
            heading: '自動コピーに失敗しました',
            messages: 'お手数ですが、上のプレビュー欄を選択して手動でコピーしてください。',
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
          heading: '動作確認用のサンプルJSON（2件：余弦定理・運動エネルギー）を入力しました',
          messages: '「インポートして追加」ボタンを押すとカードが登録されます。',
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
        this.callbacks.announce(`インポートに失敗しました。エラーが${result.errors.length}件あります。`);
        return;
      }

      const added = this.store.addMany(result.cards);
      jsonInput.setAttribute('aria-invalid', 'false');
      jsonInput.value = '';

      const firstId = added[0]?.id;
      const summaryMessages = [
        `${added.length}件の公式をローカルストレージへ保存しました（登録公式名：${added.map((c) => c.title).join('、')}）。`,
        ...result.warnings,
      ];

      importFeedback.appendChild(
        createNotificationBanner({
          type: 'success',
          heading: `${added.length}件の公式をインポートしました`,
          messages: summaryMessages,
          actions: firstId
            ? [
                {
                  label: '追加した公式を今すぐ学習する',
                  variant: 'solid-fill',
                  onClick: () => this.callbacks.onImportedAndStudy(firstId),
                },
              ]
            : [],
          dismissible: true,
        })
      );
      this.callbacks.announce(`${added.length}件の公式をインポートしました。`);
    });
  }
}
