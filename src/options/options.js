/**
 * Skript stránky „Možnosti nastavení" pro XChat Toolkit.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { ALL_FEATURES } from '../features/index.js';
import {
  buildDefaultSettings,
  loadSettings,
  saveSettings,
  onSettingsChanged,
} from '../core/Settings.js';

const ICON_SIZES = [16, 32, 48, 128, 256];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function renderIcons() {
  const grid = document.getElementById('icon-grid');
  grid.replaceChildren();
  for (const size of ICON_SIZES) {
    const fig = el('figure', {}, [
      el('img', {
        src: `/icons/icon-${size}.png`,
        alt: `Ikona ${size}×${size}`,
        width: Math.min(size, 128),
        height: Math.min(size, 128),
      }),
      el('figcaption', {}, `${size}×${size}`),
    ]);
    grid.appendChild(fig);
  }
  const svgFig = el('figure', {}, [
    el('img', { src: '/icons/icon.svg', alt: 'SVG', width: 128, height: 128 }),
    el('figcaption', {}, 'SVG (vektor)'),
  ]);
  grid.appendChild(svgFig);
}

function renderVersion() {
  const v = chrome.runtime.getManifest().version;
  document.getElementById('app-version').textContent = `verze ${v}`;
}

let saveIndicatorTimer = null;
function flashSaved() {
  const node = document.getElementById('save-indicator');
  node.textContent = '✓ Uloženo';
  clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => (node.textContent = ''), 1500);
}

function buildFeatureItem(feature, enabled, onToggle) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!enabled;
  input.addEventListener('change', () => onToggle(input.checked));

  const sw = el('label', { class: 'switch', title: enabled ? 'Vypnout' : 'Zapnout' }, [
    input,
    el('span', { class: 'slider' }),
  ]);

  return el(
    'li',
    { class: 'feature-item', dataset: { enabled: String(!!enabled) } },
    [
      sw,
      el('div', { class: 'feature-meta' }, [
        el('strong', {}, feature.name || feature.id),
        el('p', { class: 'desc' }, feature.description || ''),
        el('span', { class: 'id' }, feature.id),
      ]),
    ],
  );
}

async function renderFeatures() {
  const list = document.getElementById('feature-list');
  const settings = await loadSettings(ALL_FEATURES);

  list.replaceChildren();
  for (const feature of ALL_FEATURES) {
    const enabled = settings.features[feature.id] !== false;
    const item = buildFeatureItem(feature, enabled, async (checked) => {
      const current = await loadSettings(ALL_FEATURES);
      current.features[feature.id] = checked;
      await saveSettings(current);
      item.dataset.enabled = String(checked);
      flashSaved();
    });
    list.appendChild(item);
  }
}

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Opravdu obnovit výchozí nastavení všech funkcí?')) return;
  await saveSettings(buildDefaultSettings(ALL_FEATURES));
  await renderFeatures();
  flashSaved();
});

onSettingsChanged(() => {
  // Re-render pro případ, že se nastavení změní v jiné záložce / zařízení.
  renderFeatures();
});

renderVersion();
renderIcons();
renderFeatures();
