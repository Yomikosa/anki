/**
 * 「登録済み一覧・管理」タブ コントローラー
 * - 学習進捗サマリー・検索・フィルタ
 * - KaTeXプレビュー付きカード一覧（インラインステータス変更・学習開始・編集・削除）
 * - リアルタイムKaTeXプレビュー付き 編集／手動追加モーダル（<dialog>）
 * - JSONバックアップエクスポート・プリセット復元・初期化
 */

import { countCardClozeSlots } from './cloze.js';
import { renderKatexFormula, renderRichTextExplanation } from './katex-renderer.js';
import {
  ICONS,
  STATUS_META,
  STATUS_ORDER,
  copyToClipboard,
  createNotificationBanner,
  escapeHtml,
} from './ui-helpers.js';

export class ManageView {
  /**
   * @param {HTMLElement} root
   * @param {import('./store.js').FormulaStore} store
   * @param {{ onStudyCard: (cardId: string) => void, announce: (msg: string) => void }} callbacks
   */
  constructor(root, store, callbacks) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;

    this.searchQuery = '';
    this.statusFilter = 'all';
    this.editingCardId = null; // null なら新規作成

    this._ensureModals();
    this.render();
  }

  _ensureModals() {
    this.editDialog = document.getElementById('formula-edit-dialog');
    this.confirmDialog = document.getElementById('confirm-action-dialog');
    this._bindEditDialogEvents();
  }

  _getFilteredCards() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.store.getAll().filter((card) => {
      if (this.statusFilter !== 'all' && card.status !== this.statusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [card.title, card.subject, card.category, card.question, card.formula, card.explanation]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  render() {
    const stats = this.store.getStats();
    const filtered = this._getFilteredCards();

    this.root.innerHTML = `
      <!-- 進捗サマリー -->
      <section class="manage-summary glass-panel" aria-label="全体の学習進捗">
        <div class="manage-summary__header">
          <div>
            <h2 class="dads-heading-md">登録済み公式と習得状況</h2>
            <p class="dads-support-text">データはブラウザの <code>localStorage</code> に自動保存されています。</p>
          </div>
          <button type="button" id="manage-add-manual-btn" class="dads-button" data-type="solid-fill" data-size="md">
            ${ICONS.plus}
            <span>手動で公式を追加</span>
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-tile">
            <span class="stat-tile__label">総登録数</span>
            <strong class="stat-tile__value">${stats.total}<span class="stat-tile__unit">件</span></strong>
          </div>
          <div class="stat-tile stat-tile--mastered">
            <span class="stat-tile__label">習得済み</span>
            <strong class="stat-tile__value">${stats.mastered}<span class="stat-tile__unit">件</span></strong>
          </div>
          <div class="stat-tile stat-tile--review">
            <span class="stat-tile__label">復習が必要</span>
            <strong class="stat-tile__value">${stats.review}<span class="stat-tile__unit">件</span></strong>
          </div>
          <div class="stat-tile stat-tile--unlearned">
            <span class="stat-tile__label">未習得</span>
            <strong class="stat-tile__value">${stats.unlearned}<span class="stat-tile__unit">件</span></strong>
          </div>
        </div>

        <div class="dads-progress-wrap" aria-label="習得率 ${stats.masteryRate}%">
          <div class="dads-progress-meta">
            <span>全体の習得率</span>
            <strong>${stats.masteryRate}%</strong>
          </div>
          <div class="dads-progress-track" role="progressbar" aria-valuenow="${stats.masteryRate}" aria-valuemin="0" aria-valuemax="100">
            <div class="dads-progress-bar" style="width: ${stats.masteryRate}%"></div>
          </div>
        </div>
      </section>

      <!-- 検索・絞り込みバー -->
      <section class="manage-toolbar glass-panel" aria-label="公式の検索と絞り込み">
        <div class="manage-toolbar__search">
          <label for="manage-search-input" class="dads-form-label">キーワード検索</label>
          <input
            type="search"
            id="manage-search-input"
            class="dads-input"
            value="${escapeHtml(this.searchQuery)}"
            placeholder="公式名・科目・単元・キーワードで検索..."
          />
        </div>
        <div class="manage-toolbar__status">
          <label for="manage-status-select" class="dads-form-label">ステータス</label>
          <select id="manage-status-select" class="dads-select">
            <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>すべて（${stats.total}）</option>
            <option value="unlearned" ${this.statusFilter === 'unlearned' ? 'selected' : ''}>未習得（${stats.unlearned}）</option>
            <option value="review" ${this.statusFilter === 'review' ? 'selected' : ''}>復習が必要（${stats.review}）</option>
            <option value="mastered" ${this.statusFilter === 'mastered' ? 'selected' : ''}>習得済み（${stats.mastered}）</option>
          </select>
        </div>
      </section>

      <div id="manage-feedback-slot" class="banner-slot" aria-live="polite"></div>

      <!-- カード一覧 -->
      <section class="manage-list-section" aria-label="登録済み公式一覧">
        ${
          filtered.length > 0
            ? `<div class="manage-card-list">
                ${filtered.map((card) => this._renderManageCardHtml(card)).join('')}
               </div>`
            : `<div class="empty-state glass-panel">
                 <h3 class="dads-heading-sm">該当する公式が見つかりませんでした</h3>
                 <p class="empty-state__desc">検索語やステータス条件を変更してお試しください。</p>
               </div>`
        }
      </section>

      <!-- データバックアップ＆初期化 -->
      <section class="manage-data-panel glass-panel" aria-labelledby="data-management-heading">
        <h2 id="data-management-heading" class="dads-heading-sm">データのバックアップ・復元</h2>
        <p class="dads-support-text">
          機種変更やブラウザのデータ消去に備えて、全公式を JSON 形式で保存できます。
        </p>
        <div class="manage-data-actions">
          <button type="button" id="export-copy-btn" class="dads-button" data-type="outline" data-size="sm">
            ${ICONS.copy}
            <span>全データをJSONコピー</span>
          </button>
          <button type="button" id="export-download-btn" class="dads-button" data-type="outline" data-size="sm">
            ${ICONS.download}
            <span>JSONファイル保存</span>
          </button>
          <button type="button" id="restore-presets-btn" class="dads-button" data-type="outline" data-size="sm">
            <span>初期サンプルを復元追加</span>
          </button>
          <button type="button" id="reset-all-btn" class="dads-button dads-button--danger" data-type="text" data-size="sm">
            ${ICONS.trash}
            <span>初期状態にリセット</span>
          </button>
        </div>
      </section>
    `;

    // 各カード内の KaTeX プレビューを描画
    for (const card of filtered) {
      const mathEl = this.root.querySelector(`[data-preview-formula-id="${CSS.escape(card.id)}"]`);
      if (mathEl) {
        renderKatexFormula(mathEl, card.formula, {
          displayMode: true,
          mode: 'preview',
        });
      }
    }

    this._bindEvents();
  }

  _renderManageCardHtml(card) {
    const slotCount = countCardClozeSlots(card);
    return `
      <article class="manage-card glass-panel" data-card-id="${escapeHtml(card.id)}">
        <div class="manage-card__top">
          <div class="manage-card__badges">
            <span class="dads-chip-label" data-style="filled-1" data-color="blue">${escapeHtml(card.subject)}</span>
            ${
              card.category
                ? `<span class="dads-chip-label" data-style="outlined" data-color="gray">${escapeHtml(card.category)}</span>`
                : ''
            }
            <span class="dads-chip-label" data-style="outlined" data-color="orange">穴埋め ${slotCount}箇所</span>
          </div>

          <div class="manage-card__status-inline">
            <label for="status-select-${escapeHtml(card.id)}" class="sr-only">「${escapeHtml(card.title)}」の習得ステータス</label>
            <select
              id="status-select-${escapeHtml(card.id)}"
              class="dads-select dads-select--compact status-select-${card.status}"
              data-inline-status="${escapeHtml(card.id)}"
            >
              ${STATUS_ORDER.map(
                (k) =>
                  `<option value="${k}" ${card.status === k ? 'selected' : ''}>${STATUS_META[k].label}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <h3 class="manage-card__title">${escapeHtml(card.title)}</h3>
        ${card.question ? `<p class="manage-card__question">${escapeHtml(card.question)}</p>` : ''}

        <div class="manage-card__formula-preview" data-preview-formula-id="${escapeHtml(card.id)}"></div>

        <div class="manage-card__actions">
          <button type="button" class="dads-button" data-type="solid-fill" data-size="sm" data-action-study="${escapeHtml(card.id)}">
            ${ICONS.study}
            <span>この公式を学習</span>
          </button>
          <button type="button" class="dads-button" data-type="outline" data-size="sm" data-action-edit="${escapeHtml(card.id)}">
            ${ICONS.edit}
            <span>編集</span>
          </button>
          <button type="button" class="dads-button dads-button--danger" data-type="text" data-size="sm" data-action-delete="${escapeHtml(card.id)}">
            ${ICONS.trash}
            <span>削除</span>
          </button>
        </div>
      </article>
    `;
  }

  _showFeedback(type, heading, messages) {
    const slot = this.root.querySelector('#manage-feedback-slot');
    if (!slot) return;
    slot.innerHTML = '';
    slot.appendChild(
      createNotificationBanner({
        type,
        heading,
        messages,
        dismissible: true,
      })
    );
  }

  _bindEvents() {
    const searchInput = this.root.querySelector('#manage-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      const pos = e.target.selectionStart;
      this.render();
      const nextInput = this.root.querySelector('#manage-search-input');
      if (nextInput) {
        nextInput.focus();
        if (typeof pos === 'number') {
          nextInput.setSelectionRange(pos, pos);
        }
      }
    });

    const statusSelect = this.root.querySelector('#manage-status-select');
    statusSelect?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.render();
    });

    this.root.querySelector('#manage-add-manual-btn')?.addEventListener('click', () => {
      this._openEditModal(null);
    });

    this.root.querySelectorAll('[data-inline-status]').forEach((select) => {
      select.addEventListener('change', (e) => {
        const id = select.dataset.inlineStatus;
        const nextStatus = e.target.value;
        this.store.setStatus(id, nextStatus);
        this.callbacks.announce(`ステータスを「${STATUS_META[nextStatus].label}」に変更しました。`);
      });
    });

    this.root.querySelectorAll('[data-action-study]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onStudyCard(btn.dataset.actionStudy);
      });
    });

    this.root.querySelectorAll('[data-action-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = this.store.getById(btn.dataset.actionEdit);
        if (card) this._openEditModal(card);
      });
    });

    this.root.querySelectorAll('[data-action-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = this.store.getById(btn.dataset.actionDelete);
        if (!card) return;
        this._openConfirmModal({
          title: '公式を削除しますか？',
          body: `「${card.title}」を一覧から削除します。この操作は取り消せません。`,
          confirmLabel: '削除する',
          onConfirm: () => {
            this.store.remove(card.id);
            this._showFeedback('info', `「${card.title}」を削除しました`, '');
            this.callbacks.announce(`「${card.title}」を削除しました。`);
          },
        });
      });
    });

    this.root.querySelector('#export-copy-btn')?.addEventListener('click', async () => {
      const json = this.store.exportJson();
      const ok = await copyToClipboard(json);
      if (ok) {
        this._showFeedback(
          'success',
          '全公式データを JSON 形式でコピーしました',
          `現在登録されている ${this.store.getAll().length} 件の公式をクリップボードへコピーしました。`
        );
      } else {
        this._showFeedback('warning', 'コピーに失敗しました', '「JSONファイル保存」をお試しください。');
      }
    });

    this.root.querySelector('#export-download-btn')?.addEventListener('click', () => {
      const json = this.store.exportJson();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `formula-anki-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this._showFeedback('success', 'JSONバックアップファイルを保存しました', a.download);
    });

    this.root.querySelector('#restore-presets-btn')?.addEventListener('click', () => {
      const addedCount = this.store.restorePresets();
      if (addedCount > 0) {
        this._showFeedback(
          'success',
          `初期サンプル公式を ${addedCount} 件復元しました`,
          '削除されていたプリセット公式を再追加しました。'
        );
      } else {
        this._showFeedback(
          'info',
          '初期サンプル公式はすべて登録済みです',
          '新しく追加するプリセットはありませんでした。'
        );
      }
    });

    this.root.querySelector('#reset-all-btn')?.addEventListener('click', () => {
      this._openConfirmModal({
        title: 'すべてのデータを初期化しますか？',
        body: '追加した公式や学習ステータスをすべて消去し、初期サンプル3件の状態に戻します。必要に応じて先にJSONバックアップを保存してください。',
        confirmLabel: '初期状態に戻す',
        onConfirm: () => {
          this.store.resetToPresets();
          this._showFeedback('info', 'データを初期状態（サンプル3件）へリセットしました', '');
          this.callbacks.announce('データを初期状態にリセットしました。');
        },
      });
    });
  }

  _bindEditDialogEvents() {
    if (!this.editDialog) return;

    const form = this.editDialog.querySelector('#formula-edit-form');
    const cancelBtn = this.editDialog.querySelector('#edit-cancel-btn');
    const closeIconBtn = this.editDialog.querySelector('#edit-close-icon-btn');
    const formulaInput = this.editDialog.querySelector('#edit-formula');
    const explanationInput = this.editDialog.querySelector('#edit-explanation');

    const closeEdit = () => this.editDialog.close();
    cancelBtn?.addEventListener('click', closeEdit);
    closeIconBtn?.addEventListener('click', closeEdit);

    formulaInput?.addEventListener('input', () => this._updateEditPreview());
    explanationInput?.addEventListener('input', () => this._updateEditPreview());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = this.editDialog.querySelector('#edit-title');
      const subjectInput = this.editDialog.querySelector('#edit-subject');
      const categoryInput = this.editDialog.querySelector('#edit-category');
      const questionInput = this.editDialog.querySelector('#edit-question');
      const statusInput = this.editDialog.querySelector('#edit-status');
      const errSlot = this.editDialog.querySelector('#edit-error-slot');

      const title = titleInput.value.trim();
      const formula = formulaInput.value.trim();

      errSlot.innerHTML = '';
      if (!title || !formula) {
        errSlot.appendChild(
          createNotificationBanner({
            type: 'error',
            heading: '必須項目を入力してください',
            messages: '「公式名」と「LaTeX数式」は必須です。',
          })
        );
        return;
      }

      const payload = {
        title,
        subject: subjectInput.value.trim() || '未分類',
        category: categoryInput.value.trim(),
        question: questionInput.value.trim() || `${title}の公式を答えよ。`,
        formula,
        explanation: explanationInput.value.trim(),
        status: statusInput.value,
      };

      if (this.editingCardId) {
        this.store.update(this.editingCardId, payload);
        this.editDialog.close();
        this._showFeedback('success', `「${payload.title}」を更新しました`, '');
        this.callbacks.announce(`「${payload.title}」を更新しました。`);
      } else {
        this.store.addOne(payload);
        this.editDialog.close();
        this._showFeedback('success', `「${payload.title}」を新しく追加しました`, '');
        this.callbacks.announce(`「${payload.title}」を追加しました。`);
      }
    });
  }

  _openEditModal(card) {
    if (!this.editDialog) return;
    this.editingCardId = card ? card.id : null;

    this.editDialog.querySelector('#edit-dialog-title').textContent = card
      ? '公式を編集'
      : '公式を手動で追加';
    this.editDialog.querySelector('#edit-title').value = card?.title || '';
    this.editDialog.querySelector('#edit-subject').value = card?.subject || '数学';
    this.editDialog.querySelector('#edit-category').value = card?.category || '';
    this.editDialog.querySelector('#edit-question').value = card?.question || '';
    this.editDialog.querySelector('#edit-formula').value = card?.formula || '';
    this.editDialog.querySelector('#edit-explanation').value = card?.explanation || '';
    this.editDialog.querySelector('#edit-status').value = card?.status || 'unlearned';
    this.editDialog.querySelector('#edit-error-slot').innerHTML = '';

    this._updateEditPreview();
    this.editDialog.showModal();
  }

  _updateEditPreview() {
    const formulaVal = this.editDialog.querySelector('#edit-formula')?.value || '';
    const explanationVal = this.editDialog.querySelector('#edit-explanation')?.value || '';
    const formulaPreviewEl = this.editDialog.querySelector('#edit-formula-preview');
    const explanationPreviewEl = this.editDialog.querySelector('#edit-explanation-preview');

    if (formulaPreviewEl) {
      if (formulaVal.trim()) {
        renderKatexFormula(formulaPreviewEl, formulaVal, {
          displayMode: true,
          mode: 'preview',
        });
      } else {
        formulaPreviewEl.innerHTML = '<span class="dads-support-text">数式を入力するとプレビューが表示されます</span>';
      }
    }

    if (explanationPreviewEl) {
      if (explanationVal.trim()) {
        renderRichTextExplanation(explanationPreviewEl, explanationVal, {
          mode: 'preview',
        });
      } else {
        explanationPreviewEl.innerHTML = '';
      }
    }
  }

  _openConfirmModal({ title, body, confirmLabel, onConfirm }) {
    if (!this.confirmDialog) {
      if (window.confirm(`${title}\n${body}`)) onConfirm();
      return;
    }

    const titleEl = this.confirmDialog.querySelector('#confirm-dialog-title');
    const bodyEl = this.confirmDialog.querySelector('#confirm-dialog-body');
    const cancelBtn = this.confirmDialog.querySelector('#confirm-cancel-btn');
    const okBtn = this.confirmDialog.querySelector('#confirm-ok-btn');

    titleEl.textContent = title;
    bodyEl.textContent = body;
    okBtn.textContent = confirmLabel;

    // 既存イベントをクリーンアップするためボタンを複製置換
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.replaceWith(newOkBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancelBtn);

    newCancelBtn.addEventListener('click', () => this.confirmDialog.close());
    newOkBtn.addEventListener('click', () => {
      this.confirmDialog.close();
      onConfirm();
    });

    this.confirmDialog.showModal();
  }
}
