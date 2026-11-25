/**
 * アプリケーションエントリーポイント
 * - DADS準拠タブコントローラー（クリック + キーボード ArrowLeft/Right/Home/End）
 * - ヘッダー習得状況バッジのリアルタイム更新
 * - 3タブ間のスムーズな連携
 */

import { FormulaStore } from './store.js';
import { StudyView } from './ui-study.js';
import { ImportView } from './ui-import.js';
import { ManageView } from './ui-manage.js';

function initApp() {
  const store = new FormulaStore();
  const liveRegion = document.getElementById('sr-live-region');

  const announce = (message) => {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  };

  // DADS タブ管理
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  const activateTab = (tabName, moveFocus = false) => {
    tabs.forEach((tab) => {
      const isSelected = tab.dataset.tab === tabName;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      if (isSelected && moveFocus) {
        tab.focus();
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === tabName;
      panel.hidden = !isActive;
    });

    // タブ切替時に最新データを反映
    if (tabName === 'study') {
      studyView.render();
    } else if (tabName === 'manage') {
      manageView.render();
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activateTab(tab.dataset.tab, false);
    });

    // DADS アクセシビリティ仕様：左右キー・Home・Endでのタブフォーカス移動
    tab.addEventListener('keydown', (event) => {
      let targetIdx = null;
      if (event.key === 'ArrowRight') {
        targetIdx = (index + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        targetIdx = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        targetIdx = 0;
      } else if (event.key === 'End') {
        targetIdx = tabs.length - 1;
      }

      if (targetIdx !== null) {
        event.preventDefault();
        activateTab(tabs[targetIdx].dataset.tab, true);
      }
    });
  });

  // 各タブのビューを初期化
  const studyView = new StudyView(document.getElementById('panel-study'), store, {
    onNavigateToImport: () => activateTab('import', true),
    announce,
  });

  new ImportView(document.getElementById('panel-import'), store, {
    onImportedAndStudy: (firstCardId) => {
      activateTab('study', false);
      studyView.focusCard(firstCardId);
    },
    announce,
  });

  const manageView = new ManageView(document.getElementById('panel-manage'), store, {
    onStudyCard: (cardId) => {
      activateTab('study', false);
      studyView.focusCard(cardId);
    },
    announce,
  });

  // ヘッダーおよびタブの件数サマリー更新
  const updateHeaderSummary = () => {
    const stats = store.getStats();
    const headerSummary = document.getElementById('header-progress-summary');
    const manageCountBadge = document.getElementById('tab-manage-count');
    if (headerSummary) {
      headerSummary.innerHTML = `
        <span class="header-stat">習得 <strong>${stats.mastered}</strong> / ${stats.total}</span>
        <span class="header-stat-rate" aria-label="習得率 ${stats.masteryRate}%">${stats.masteryRate}%</span>
      `;
    }
    if (manageCountBadge) {
      manageCountBadge.textContent = String(stats.total);
    }
  };

  store.subscribe(() => {
    updateHeaderSummary();
    const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.dataset.tab;
    if (activeTab === 'study') {
      studyView.render();
    } else if (activeTab === 'manage') {
      manageView.render();
    }
  });

  updateHeaderSummary();
}

// defer / module 実行後に KaTeX 読み込み完了を確実に待って初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
