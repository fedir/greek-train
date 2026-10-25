// Greek Train — Greek noun gender trainer
// Copyright (C) 2026 Fedir RYKHTIK
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. See the LICENSE file for details.

import { recordAnswer, getAllStats, getWrongRate, clearWrong } from './storage.js?v=20261023.5';
import { pronounceGreek } from './transliteration.js?v=20261023.5';

const TABS = [
  { key: 'browse', label: 'Apprendre' },
  { key: 'quiz', label: 'Test' },
  { key: 'tricky', label: 'Pièges' },
  { key: 'rules', label: 'Règles' },
];

const QUIZ_POOL_SIZE = 2000;
const PAGE_SIZE = 60;

let dataPromise = null;

function loadData() {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetch('data/nouns.json').then((r) => r.json()),
      fetch('data/tricky-nouns.json').then((r) => r.json()),
      fetch('data/gender-rules.json').then((r) => r.json()),
      fetch('data/audio-manifest.json').then((r) => r.json()),
    ]).then(([nouns, tricky, rules, audioManifest]) => ({ nouns, tricky, rules, audioManifest }));
  }
  return dataPromise;
}

function article(genre, word) {
  if (genre === 'm') return `ο ${word}`;
  if (genre === 'f') return `η ${word}`;
  return `το ${word}`;
}

function frArticle(genre, word) {
  return `${genre === 'm' ? 'un' : 'une'} ${word}`;
}

function genreLabel(genre) {
  if (genre === 'm') return 'Masculin';
  if (genre === 'f') return 'Féminin';
  return 'Neutre';
}

function genreClass(genre) {
  return `genre-${genre}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderTabs(active) {
  return `<div class="tabs" role="tablist">${TABS.map((t) => `
    <a href="#/nouns/${t.key}" class="tab ${t.key === active ? 'active' : ''}" role="tab">${t.label}</a>
  `).join('')}</div>`;
}

function weightedSample(items, weightFn, k) {
  const keyed = items.map((item) => ({
    item,
    key: Math.pow(Math.random(), 1 / Math.max(weightFn(item), 0.0001)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map((e) => e.item);
}

// ---------- Browse view ----------

const TIERS = [
  { key: 'essential', label: 'Essentiel', start: 0, end: 500 },
  { key: 'common', label: 'Courant', start: 500, end: 2000 },
  { key: 'extended', label: 'Étendu', start: 2000, end: Infinity },
];

function tierOfIndex(index) {
  if (index < 500) return 'essential';
  if (index < 2000) return 'common';
  return 'extended';
}

function getWeakWords(allWords) {
  const stats = getAllStats();
  const byOrtho = new Map(allWords.map((n) => [n.ortho, n]));
  return Object.keys(stats)
    .filter((ortho) => stats[ortho].wrong > 0 && byOrtho.has(ortho))
    .map((ortho) => ({ ortho, rate: getWrongRate(ortho), entry: byOrtho.get(ortho) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)
    .map((w) => w.entry);
}

function renderWeakWords(weakWords) {
  if (weakWords.length === 0) return '';
  return `
    <section class="panel weak-panel">
      <h2>Mots à revoir</h2>
      <div class="chip-row">
        ${weakWords.map((entry) => `<span class="chip chip-${entry.genre}">${article(entry.genre, entry.ortho)}</span>`).join('')}
      </div>
      <button id="weak-retest" class="btn btn-secondary">Refaire le test avec ces mots</button>
    </section>`;
}

function mountBrowse(container, nouns, initialTier, audioManifest = {}, initialTierWords = null) {
  const allWords = nouns.map((n, i) => ({ ...n, tier: tierOfIndex(i), audioFile: audioManifest[n.ortho] }));
  const weakWords = getWeakWords(allWords);
  let tier = TIERS.some((t) => t.key === initialTier) ? initialTier : 'essential';
  let query = '';
  let shown = PAGE_SIZE;
  let tierWords = initialTierWords || allWords.filter((n) => n.tier === tier);
  function playCardAudio(card) {
    const audio = card.querySelector('.card-audio');
    if (!audio) return;
    container.querySelectorAll('.card-audio').forEach((other) => {
      if (other !== audio) other.pause();
    });
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function filtered() {
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return allWords.filter((n) => n.ortho.toLowerCase().includes(q));
    }
    return tierWords;
  }

  function renderList() {
    const list = filtered();
    const visible = list.slice(0, shown);
    const listEl = container.querySelector('#noun-list');
    listEl.innerHTML = visible.map((n) => `
      <button class="flip-card" data-ortho="${escapeHtml(n.ortho)}" data-genre="${n.genre}" aria-pressed="false">
        <span class="flip-front">${escapeHtml(n.ortho)}</span>
        <span class="flip-back ${genreClass(n.genre)}">${escapeHtml(article(n.genre, n.ortho))}<br>${escapeHtml(frArticle(n.fr_genre, n.fr_word))}</span>
        ${n.audioFile ? `<audio class="card-audio" preload="none"><source src="audio/${encodeURIComponent(n.audioFile)}" type="audio/ogg; codecs=opus"></audio>` : ''}
      </button>
    `).join('') || '<p class="empty">Aucun mot trouvé.</p>';
    const moreBtn = container.querySelector('#load-more');
    moreBtn.hidden = shown >= list.length;
  }

  container.innerHTML = `
    ${renderWeakWords(weakWords)}
    <section class="panel">
      <div class="browse-controls">
        <div class="tier-select" role="group" aria-label="Niveau de fréquence">
          ${TIERS.map((t) => `<span class="tier-control"><button class="tier-btn ${t.key === tier ? 'active' : ''}" data-tier="${t.key}">${t.label}</button><button class="tier-play" data-play-tier="${t.key}" aria-label="Lancer la présentation ${t.label}" title="Lancer la présentation ${t.label}">▶</button></span>`).join('')}
        </div>
        <input type="search" id="noun-search" placeholder="Rechercher un mot…" aria-label="Rechercher un mot">
      </div>
      <div class="browse-hint"><p class="hint" id="tier-hint">Touche une carte pour voir le genre et la traduction.</p><button id="remix-cards" class="btn remix-btn" type="button">Remix</button></div>
      <div id="noun-list" class="card-grid"></div>
      <button id="load-more" class="btn btn-secondary">Charger plus</button>
    </section>
  `;
  container.querySelectorAll('.tier-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tier !== tier) location.hash = `#/nouns/browse/${btn.dataset.tier}`;
    });
  });

  container.querySelectorAll('[data-play-tier]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedTier = TIERS.find((t) => t.key === btn.dataset.playTier);
      const words = selectedTier.key === tier
        ? tierWords
        : allWords.slice(selectedTier.start, selectedTier.end);
      mountPlayer(container, words, selectedTier.label, () => mountBrowse(container, nouns, tier, audioManifest, tierWords));
    });
  });

  const retestBtn = container.querySelector('#weak-retest');
  if (retestBtn) {
    retestBtn.addEventListener('click', () => {
      runQuiz(container, weakWords, {
        title: 'Révision',
        restartLabel: 'Retour',
        onFinish: (score, total) => {
          if (score === total) weakWords.forEach((w) => clearWrong(w.ortho));
          mountBrowse(container, nouns, tier, audioManifest);
        },
      });
    });
  }

  container.querySelector('#noun-search').addEventListener('input', (e) => {
    query = e.target.value;
    shown = PAGE_SIZE;
    renderList();
  });

  container.querySelector('#remix-cards').addEventListener('click', () => {
    query = '';
    container.querySelector('#noun-search').value = '';
    for (let i = tierWords.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [tierWords[i], tierWords[j]] = [tierWords[j], tierWords[i]];
    }
    shown = PAGE_SIZE;
    renderList();
  });

  container.querySelector('#load-more').addEventListener('click', () => {
    shown += PAGE_SIZE;
    renderList();
  });

  container.querySelector('#noun-list').addEventListener('click', (e) => {
    const card = e.target.closest('.flip-card');
    if (!card) return;
    const flipped = card.classList.toggle('flipped');
    card.setAttribute('aria-pressed', String(flipped));
    if (flipped) playCardAudio(card);
  });

  renderList();
}

// ---------- Full-screen vocabulary player ----------

function mountPlayer(container, words, tierLabel, onClose) {
  let index = 0;
  let touchStartX = null;
  let closed = false;
  let autoplay = false;
  let autoplayTimer = null;

  function stopAutoplay() {
    autoplay = false;
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }

  function updateAutoplayButton() {
    const button = container.querySelector('#player-autoplay');
    if (!button) return;
    button.textContent = autoplay ? '⏸' : '▶';
    button.setAttribute('aria-label', autoplay ? 'Mettre en pause la lecture automatique' : 'Démarrer la lecture automatique');
    button.title = autoplay ? 'Mettre en pause' : 'Lecture automatique';
    button.setAttribute('aria-pressed', String(autoplay));
  }

  function playCurrentAudio() {
    const audio = container.querySelector('#player-audio');
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function scheduleAutoplay() {
    clearTimeout(autoplayTimer);
    if (!autoplay) return;
    autoplayTimer = setTimeout(() => {
      if (index === words.length - 1) {
        stopAutoplay();
        updateAutoplayButton();
        return;
      }
      move(1, true);
    }, 5000);
  }

  function close() {
    if (closed) return;
    closed = true;
    stopAutoplay();
    container.classList.remove('player-active');
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }

  function move(delta, fromAutoplay = false) {
    if (!fromAutoplay) stopAutoplay();
    const next = index + delta;
    if (next < 0 || next >= words.length) {
      updateAutoplayButton();
      return;
    }
    index = next;
    render();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      move(1);
    }
  }

  function handleFullscreenChange() {
    if (!closed && !document.fullscreenElement) close();
  }

  function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) < 50) return;
    move(distance < 0 ? 1 : -1);
  }

  function render() {
    const word = words[index];
    container.innerHTML = `
      <section class="word-player ${genreClass(word.genre)}" aria-label="Présentation de vocabulaire" tabindex="-1">
        <div class="player-header"><span>${escapeHtml(tierLabel)} · ${index + 1} / ${words.length}</span><button class="player-close" aria-label="Quitter la présentation">×</button></div>
        <button class="player-repeat" type="button" aria-label="Répéter la prononciation" title="Répéter la prononciation">
          <span class="player-word">${escapeHtml(article(word.genre, word.ortho))}</span>
          <span class="player-pronunciation">${escapeHtml(pronounceGreek(article(word.genre, word.ortho)))}</span>
          <span class="player-translation">${escapeHtml(frArticle(word.fr_genre, word.fr_word))}</span>
        </button>
        ${word.audioFile ? `<audio id="player-audio" preload="auto"><source src="audio/${encodeURIComponent(word.audioFile)}" type="audio/ogg; codecs=opus"></audio>` : ''}
        <div class="player-controls"><button class="btn player-nav" data-direction="-1" ${index === 0 ? 'disabled' : ''}>← Précédent</button><button id="player-autoplay" class="btn player-autoplay" type="button" aria-pressed="${autoplay}" aria-label="${autoplay ? 'Mettre en pause la lecture automatique' : 'Démarrer la lecture automatique'}" title="${autoplay ? 'Mettre en pause' : 'Lecture automatique'}">${autoplay ? '⏸' : '▶'}</button><button class="btn player-nav" data-direction="1" ${index === words.length - 1 ? 'disabled' : ''}>Suivant →</button></div>
        <p class="player-hint">Espace, Entrée ou → : suivant · ← : précédent · balayez sur mobile</p>
      </section>`;
    container.querySelector('.player-close').addEventListener('click', close);
    container.querySelector('.player-repeat').addEventListener('click', () => {
      stopAutoplay();
      updateAutoplayButton();
      playCurrentAudio();
    });
    container.querySelectorAll('[data-direction]').forEach((btn) => btn.addEventListener('click', () => move(Number(btn.dataset.direction))));
    container.querySelector('#player-autoplay').addEventListener('click', () => {
      if (autoplay) {
        stopAutoplay();
        updateAutoplayButton();
        return;
      }
      autoplay = true;
      playCurrentAudio();
      scheduleAutoplay();
      updateAutoplayButton();
    });
    playCurrentAudio();
    scheduleAutoplay();
  }

  container.classList.add('player-active');
  render();
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });
  const player = container.querySelector('.word-player');
  player.focus();
  container.requestFullscreen?.().catch(() => {});
}

// ---------- Quiz view ----------

function runQuiz(container, questions, { onFinish, title, restartLabel = 'Recommencer' } = {}) {
  let index = 0;
  let score = 0;
  let answered = false;
  let lastCorrect = false;
  const missed = [];

  function renderQuestion() {
    const q = questions[index];
    container.innerHTML = `
      <section class="panel quiz-panel">
        <p class="quiz-progress">${title ? title + ' — ' : ''}Question ${index + 1} / ${questions.length} · Score ${score}</p>
        <div class="quiz-word">${escapeHtml(q.ortho)}</div>
        <div class="quiz-actions">
          <button class="btn btn-masc" data-genre="m">Masculin</button>
          <button class="btn btn-fem" data-genre="f">Féminin</button>
          <button class="btn btn-neut" data-genre="n">Neutre</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      </section>
    `;
    container.querySelectorAll('.quiz-actions .btn').forEach((btn) => {
      btn.addEventListener('click', () => handleAnswer(btn.dataset.genre));
    });
  }

  function handleAnswer(genre) {
    if (answered) return;
    answered = true;
    const q = questions[index];
    lastCorrect = genre === q.genre;
    if (lastCorrect) score += 1;
    else missed.push(q);
    recordAnswer(q.ortho, lastCorrect);

    const feedback = container.querySelector('#quiz-feedback');
    feedback.innerHTML = `
      <p class="${lastCorrect ? 'feedback-correct' : 'feedback-wrong'}">
        ${lastCorrect ? 'Correct !' : 'Faux.'} C'est <strong>${genreLabel(q.genre).toLowerCase()}</strong> :
        ${escapeHtml(article(q.genre, q.ortho))} (${escapeHtml(frArticle(q.fr_genre, q.fr_word))})
      </p>
      <button id="quiz-next" class="btn btn-primary">${index + 1 < questions.length ? 'Suivant' : 'Voir le score'}</button>
    `;
    container.querySelectorAll('.quiz-actions .btn').forEach((btn) => { btn.disabled = true; });
    container.querySelector('#quiz-next').addEventListener('click', next);
  }

  function next() {
    answered = false;
    index += 1;
    if (index >= questions.length) {
      renderSummary();
    } else {
      renderQuestion();
    }
  }

  function renderSummary() {
    container.innerHTML = `
      <section class="panel quiz-panel">
        <h2>Résultat</h2>
        <p class="quiz-score">${score} / ${questions.length}</p>
        ${missed.length ? `
          <h3>Mots à revoir</h3>
          <div class="chip-row">
            ${missed.map((q) => `<span class="chip chip-${q.genre}">${escapeHtml(article(q.genre, q.ortho))}</span>`).join('')}
          </div>` : '<p>Aucune erreur, bravo !</p>'}
        <button id="quiz-restart" class="btn btn-primary">${escapeHtml(restartLabel)}</button>
      </section>
    `;
    container.querySelector('#quiz-restart').addEventListener('click', () => onFinish && onFinish(score, questions.length));
  }

  renderQuestion();
}

const QUIZ_CATEGORIES = [{ key: 'all', label: 'Tous' }, ...TIERS];

function poolForCategory(category, nouns) {
  if (category === 'all') return nouns.slice(0, QUIZ_POOL_SIZE);
  const t = TIERS.find((x) => x.key === category);
  return nouns.slice(t.start, Math.min(t.end, nouns.length));
}

function mountQuiz(container, nouns, initialCategory) {
  let category = QUIZ_CATEGORIES.some((c) => c.key === initialCategory) ? initialCategory : 'all';

  function start(length) {
    const pool = poolForCategory(category, nouns);
    const weight = (n) => n.freq * (1 + 2 * getWrongRate(n.ortho));
    const questions = weightedSample(pool, weight, Math.min(length, pool.length));
    runQuiz(container, questions, { onFinish: () => mountQuiz(container, nouns, category) });
  }

  function renderStart() {
    container.innerHTML = `
      <section class="panel">
        <h2>Test dynamique</h2>
        <p>Les questions sont tirées des noms les plus fréquents, avec une priorité pour les mots que tu as déjà ratés.</p>
        <div class="tier-select" role="group" aria-label="Catégorie">
          ${QUIZ_CATEGORIES.map((c) => `<button class="tier-btn ${c.key === category ? 'active' : ''}" data-cat="${c.key}">${c.label}</button>`).join('')}
        </div>
        <div class="quiz-start-actions">
          <button class="btn btn-primary" data-len="10">10 questions</button>
          <button class="btn btn-primary" data-len="20">20 questions</button>
        </div>
      </section>
    `;
    container.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        category = btn.dataset.cat;
        renderStart();
      });
    });
    container.querySelectorAll('[data-len]').forEach((btn) => {
      btn.addEventListener('click', () => start(Number(btn.dataset.len)));
    });
  }

  renderStart();
}

// ---------- Tricky words view ----------
// Greek's three-way gender split creates a different kind of "trickiness"
// than French: there are very few true homographs whose meaning changes
// with gender, but there are many common nouns whose ending is a strong
// (and wrong) hint toward the wrong gender — e.g. "-ος" reads as masculine
// but is sometimes feminine (η οδός) or neuter (το δάσος).

function mountTricky(container, tricky) {
  container.innerHTML = `
    <section class="panel">
      <h2>Terminaisons trompeuses</h2>
      <p>Ces noms ont une terminaison qui évoque un autre genre, mais ce n'est pas le bon.</p>
      <div class="deceptive-grid">
        ${tricky.deceptive.map((d) => `
          <div class="deceptive-card">
            <div class="deceptive-word">${escapeHtml(article(d.genre, d.ortho))}</div>
            <div class="deceptive-genres">
              <span class="chip chip-outline">semble ${genreLabel(d.looks_like).toLowerCase()}</span>
              <span class="chip chip-${d.genre}">${genreLabel(d.genre)}</span>
            </div>
            <div class="deceptive-note">${escapeHtml(d.note)}</div>
          </div>
        `).join('')}
      </div>
    </section>
    <section class="panel">
      <h2>Mots homographes à genre différent</h2>
      <p>Même orthographe, genre différent <em>et</em> sens différent.</p>
      <div class="tricky-grid">
        ${tricky.homographs.map((t) => `
          <div class="tricky-card">
            <div class="tricky-side ${genreClass(t.sense_a.genre)}">
              <strong>${escapeHtml(article(t.sense_a.genre, t.ortho))}</strong>
              <span>${escapeHtml(t.sense_a.meaning)}</span>
            </div>
            <div class="tricky-side ${genreClass(t.sense_b.genre)}">
              <strong>${escapeHtml(article(t.sense_b.genre, t.ortho))}</strong>
              <span>${escapeHtml(t.sense_b.meaning)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// ---------- Rules view ----------

function mountRules(container, rules) {
  const masc = rules.endings.filter((e) => e.genre === 'm');
  const fem = rules.endings.filter((e) => e.genre === 'f');
  const neut = rules.endings.filter((e) => e.genre === 'n');

  function endingTable(rows) {
    return `<table class="rules-table">
      <thead><tr><th>Terminaison</th><th>Exemples</th><th>Exceptions</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>
          <td>${escapeHtml(r.ending)}</td>
          <td>${r.examples.map(escapeHtml).join(', ')}</td>
          <td>${r.exceptions.map(escapeHtml).join(', ') || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  container.innerHTML = `
    <section class="panel">
      <h2>Terminaisons masculines</h2>
      ${endingTable(masc)}
    </section>
    <section class="panel">
      <h2>Terminaisons féminines</h2>
      ${endingTable(fem)}
    </section>
    <section class="panel">
      <h2>Terminaisons neutres</h2>
      ${endingTable(neut)}
    </section>
    <section class="panel">
      <h2>Catégories sémantiques</h2>
      <ul class="rules-list">
        ${rules.semantic_categories.map((c) => `<li><span class="chip chip-${c.genre}">${genreLabel(c.genre)}</span> ${escapeHtml(c.category)} — ${c.examples.map(escapeHtml).join(', ')}</li>`).join('')}
      </ul>
    </section>
    <section class="panel">
      <h2>Cas particuliers</h2>
      <ul class="rules-list">
        ${rules.special_cases.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>
    </section>
  `;
}

// ---------- Section entry point ----------

async function mount(container, view, param) {
  const activeView = view || 'browse';
  container.innerHTML = `${renderTabs(activeView)}<div id="nouns-content" class="nouns-content"><p class="loading">Chargement…</p></div>`;
  const { nouns, tricky, rules, audioManifest } = await loadData();
  const content = container.querySelector('#nouns-content');
  if (activeView === 'quiz') mountQuiz(content, nouns, param);
  else if (activeView === 'tricky') mountTricky(content, tricky);
  else if (activeView === 'rules') mountRules(content, rules);
  else mountBrowse(content, nouns, param, audioManifest);
}

export const NounsSection = {
  label: 'Noms',
  mount,
};
