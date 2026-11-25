/**
 * localStorage ベースのデータ永続化ストア
 * 初回起動時はプリセット3件を自動ロードする。
 */

import { PRESET_FORMULAS } from './presets.js';
import { generateCardId, VALID_STATUSES } from './validator.js';

export const STORAGE_KEY = 'dads-formula-anki:v1:cards';
export const PREFS_STORAGE_KEY = 'dads-formula-anki:v1:prefs';

function clonePresets() {
  return PRESET_FORMULAS.map((item) => ({ ...item }));
}

export class FormulaStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.cards = [];
    this.prefs = {
      studyMode: 'cloze', // 'cloze' | 'qa'
    };
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null) {
        this.cards = clonePresets();
        this._save();
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cards = parsed.map((card) => ({
            id: card.id || generateCardId(),
            subject: card.subject || '未分類',
            category: card.category || '',
            title: card.title || '無題の公式',
            question: card.question || '',
            formula: card.formula || '',
            explanation: card.explanation || '',
            status: VALID_STATUSES.has(card.status) ? card.status : 'unlearned',
            createdAt: card.createdAt || new Date().toISOString(),
            updatedAt: card.updatedAt || new Date().toISOString(),
          }));
        } else {
          this.cards = clonePresets();
          this._save();
        }
      }
    } catch {
      this.cards = clonePresets();
    }

    try {
      const rawPrefs = this.storage.getItem(PREFS_STORAGE_KEY);
      if (rawPrefs) {
        const parsedPrefs = JSON.parse(rawPrefs);
        if (
          parsedPrefs &&
          (parsedPrefs.studyMode === 'cloze' ||
            parsedPrefs.studyMode === 'quiz' ||
            parsedPrefs.studyMode === 'qa')
        ) {
          this.prefs.studyMode = parsedPrefs.studyMode;
        }
      }
    } catch {
      // ignore prefs load failure
    }
  }

  _save() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.cards));
    } catch {
      // storage quota or private mode fallback
    }
  }

  _savePrefs() {
    try {
      this.storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      listener(this.getAll());
    }
  }

  getAll() {
    return this.cards.map((c) => ({ ...c }));
  }

  getById(id) {
    const found = this.cards.find((c) => c.id === id);
    return found ? { ...found } : null;
  }

  getStudyMode() {
    return this.prefs.studyMode;
  }

  setStudyMode(mode) {
    if (mode !== 'cloze' && mode !== 'quiz' && mode !== 'qa') return;
    this.prefs.studyMode = mode;
    this._savePrefs();
  }

  getStats() {
    const total = this.cards.length;
    let mastered = 0;
    let review = 0;
    let unlearned = 0;

    for (const c of this.cards) {
      if (c.status === 'mastered') mastered++;
      else if (c.status === 'review') review++;
      else unlearned++;
    }

    const masteryRate = total === 0 ? 0 : Math.round((mastered / total) * 100);
    return { total, mastered, review, unlearned, masteryRate };
  }

  getSubjects() {
    const set = new Set();
    for (const c of this.cards) {
      if (c.subject) set.add(c.subject);
    }
    return Array.from(set);
  }

  /**
   * 複数カードを追加（ID衝突があれば新IDを割り当て）
   * @param {Array<Object>} newCards
   * @returns {Array<Object>} 追加されたカード配列
   */
  addMany(newCards) {
    const existingIds = new Set(this.cards.map((c) => c.id));
    const added = newCards.map((card) => {
      let id = card.id || generateCardId();
      if (existingIds.has(id)) {
        id = generateCardId();
      }
      existingIds.add(id);
      return { ...card, id };
    });

    this.cards = [...this.cards, ...added];
    this._save();
    this._notify();
    return added;
  }

  addOne(cardData) {
    const now = new Date().toISOString();
    const card = {
      id: generateCardId(),
      subject: (cardData.subject || '未分類').trim() || '未分類',
      category: (cardData.category || '').trim(),
      title: (cardData.title || '').trim(),
      question: (cardData.question || '').trim(),
      formula: (cardData.formula || '').trim(),
      explanation: (cardData.explanation || '').trim(),
      status: VALID_STATUSES.has(cardData.status) ? cardData.status : 'unlearned',
      createdAt: now,
      updatedAt: now,
    };
    this.cards = [...this.cards, card];
    this._save();
    this._notify();
    return { ...card };
  }

  update(id, updates) {
    const index = this.cards.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const current = this.cards[index];
    const next = {
      ...current,
      ...updates,
      id: current.id,
      status: VALID_STATUSES.has(updates.status) ? updates.status : current.status,
      updatedAt: new Date().toISOString(),
    };
    this.cards[index] = next;
    this._save();
    this._notify();
    return { ...next };
  }

  setStatus(id, status) {
    if (!VALID_STATUSES.has(status)) return null;
    return this.update(id, { status });
  }

  remove(id) {
    const before = this.cards.length;
    this.cards = this.cards.filter((c) => c.id !== id);
    if (this.cards.length !== before) {
      this._save();
      this._notify();
      return true;
    }
    return false;
  }

  /**
   * プリセット3件のうち未登録のものを復元追加する
   * @returns {number} 追加された件数
   */
  restorePresets() {
    const existingIds = new Set(this.cards.map((c) => c.id));
    const missing = clonePresets().filter((p) => !existingIds.has(p.id));
    if (missing.length > 0) {
      this.cards = [...missing, ...this.cards];
      this._save();
      this._notify();
    }
    return missing.length;
  }

  /**
   * 初期状態（プリセット3件のみ）にリセット
   */
  resetToPresets() {
    this.cards = clonePresets();
    this._save();
    this._notify();
  }

  /**
   * JSON形式でエクスポート（インポート再取込可能な形式）
   * @returns {string}
   */
  exportJson() {
    const clean = this.cards.map(
      ({ subject, category, title, question, formula, explanation, status }) => ({
        subject,
        category,
        title,
        question,
        formula,
        explanation,
        status,
      })
    );
    return JSON.stringify(clean, null, 2);
  }
}
