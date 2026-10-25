// Greek Train — Greek noun gender trainer
// Copyright (C) 2026 Fedir RYKHTIK
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. See the LICENSE file for details.

const SIMPLE = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', τ: 't', υ: 'i', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};

const DIGRAPHS = {
  αι: 'e', ει: 'i', οι: 'i', υι: 'i', ου: 'ou',
  μπ: 'b', ντ: 'd', γκ: 'g', τσ: 'ts', τζ: 'dz', γγ: 'ng',
  γχ: 'nch', γξ: 'nx',
};

const UNVOICED = new Set(['κ', 'ξ', 'π', 'σ', 'τ', 'φ', 'χ', 'ψ', 'θ']);
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function normalise(word) {
  return word.toLocaleLowerCase('el').normalize('NFD').replace(/\u0342/g, '\u0301');
}

function nextBase(chars, index) {
  for (let i = index; i < chars.length; i += 1) {
    if (chars[i] !== '\u0301' && chars[i] !== '\u0308') return chars[i];
  }
  return '';
}

function markStress(text) {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (!VOWELS.has(text[i])) continue;
    return `${text.slice(0, i)}${({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' })[text[i]]}${text.slice(i + 1)}`;
  }
  return text;
}

// A compact pronunciation guide for French speakers, not scholarly transliteration.
export function pronounceGreek(word) {
  const chars = [...normalise(word)];
  let result = '';

  for (let i = 0; i < chars.length;) {
    const current = chars[i];
    if (current === '\u0301' || current === '\u0308') {
      i += 1;
      continue;
    }

    const stressed = chars[i + 1] === '\u0301' || chars[i + 2] === '\u0301';
    const pair = `${current}${nextBase(chars, i + 1)}`;
    if (pair === 'αυ' || pair === 'ευ' || pair === 'ηυ') {
      const next = nextBase(chars, i + 2);
      const first = pair === 'αυ' ? 'a' : pair === 'ευ' ? 'e' : 'i';
      result += `${first}${UNVOICED.has(next) ? 'f' : 'v'}`;
      if (stressed) result = markStress(result);
      i += chars[i + 1] === '\u0301' ? 2 : chars[i + 2] === '\u0301' ? 3 : 2;
      continue;
    }
    if (DIGRAPHS[pair]) {
      result += DIGRAPHS[pair];
      if (stressed) result = markStress(result);
      i += chars[i + 1] === '\u0301' ? 2 : chars[i + 2] === '\u0301' ? 3 : 2;
      continue;
    }

    const sound = SIMPLE[current] || current;
    result += sound;
    if (chars[i + 1] === '\u0301') result = markStress(result);
    i += chars[i + 1] === '\u0301' || chars[i + 1] === '\u0308' ? 2 : 1;
  }
  return result;
}
