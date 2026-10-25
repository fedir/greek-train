// Greek Train — Greek noun gender trainer
// Copyright (C) 2026 Fedir RYKHTIK
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. See the LICENSE file for details.

import { NounsSection } from './nouns.js?v=20261023.5';

const sections = {
  nouns: NounsSection,
};

const DEFAULT_SECTION = 'nouns';

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [section, view, ...rest] = hash.split('/');
  return {
    section: sections[section] ? section : DEFAULT_SECTION,
    view: view || null,
    param: rest.join('/') || null,
  };
}

function renderSectionNav(activeSection) {
  const nav = document.getElementById('section-nav');
  nav.innerHTML = Object.entries(sections).map(([key, mod]) => `
    <a href="#/${key}" class="nav-link ${key === activeSection ? 'active' : ''}">${mod.label}</a>
  `).join('');
}

function renderCredits(container) {
  container.innerHTML = `
    <section class="panel">
      <h2>Sources</h2>
      <ul class="rules-list">
        <li><strong>Wiktionary (vocabulaire grec)</strong> — genre et déclinaison des noms, via l'extraction de données <a href="https://kaikki.org/dictionary/Greek/" target="_blank" rel="noopener">kaikki.org</a> (licence CC BY-SA 4.0 / GFDL)</li>
        <li><strong>Wiktionnaire français (entrées grecques)</strong> — traductions françaises natives, via l'extraction de données <a href="https://kaikki.org/frwiktionary/Grec/" target="_blank" rel="noopener">kaikki.org</a> (licence CC BY-SA 4.0 / GFDL)</li>
        <li><strong>FrequencyWords (Hermit Dave)</strong> — fréquence des mots à partir de sous-titres (OpenSubtitles2018) — <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener">github.com/hermitdave/FrequencyWords</a> (licence MIT)</li>
      </ul>
      <p><a href="#/nouns/browse">&larr; Retour</a></p>
    </section>
  `;
}

async function render() {
  const container = document.getElementById('app');
  const top = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (top === 'credits') {
    document.querySelectorAll('#section-nav .nav-link').forEach((el) => el.classList.remove('active'));
    renderCredits(container);
    return;
  }
  const { section, view, param } = parseHash();
  renderSectionNav(section);
  await sections[section].mount(container, view, param);
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) location.hash = `#/${DEFAULT_SECTION}/browse`;
  render();
});
