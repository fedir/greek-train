// Greek Train — Greek noun gender trainer
// Copyright (C) 2026 Fedir RYKHTIK
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. See the LICENSE file for details.

const KEY = 'greekTrainProgress';

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function recordAnswer(ortho, correct) {
  const data = loadAll();
  const stats = data[ortho] || { correct: 0, wrong: 0, lastSeen: 0 };
  if (correct) stats.correct += 1;
  else stats.wrong += 1;
  stats.lastSeen = Date.now();
  data[ortho] = stats;
  saveAll(data);
}

export function getStats(ortho) {
  return loadAll()[ortho] || { correct: 0, wrong: 0, lastSeen: 0 };
}

export function getAllStats() {
  return loadAll();
}

export function getWrongRate(ortho) {
  const { correct, wrong } = getStats(ortho);
  const total = correct + wrong;
  return total === 0 ? 0 : wrong / total;
}

export function clearWrong(ortho) {
  const data = loadAll();
  if (data[ortho]) {
    data[ortho].wrong = 0;
    saveAll(data);
  }
}
