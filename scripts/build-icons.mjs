#!/usr/bin/env node
// Vygeneruje PNG ikony v různých velikostech z SVG předlohy.
// Pokud existují předrenderované PNG v `icons/xt-toolkit-rounded-square-xt/`,
// použijí se přednostně (lepší kvalita v malých rozlišeních).
// Autor: Jan Elznic <jan@elznic.com> (https://janelznic.cz)

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_SVG = resolve(ROOT, 'src/icons/icon.svg');
const PRERENDERED_DIR = resolve(ROOT, 'icons/xt-toolkit-rounded-square-xt');
const OUT_DIR = resolve(ROOT, 'public/icons');
const SIZES = [16, 32, 48, 128, 256];

async function main() {
  if (!existsSync(SRC_SVG)) {
    throw new Error(`Chybí zdrojová ikona: ${SRC_SVG}`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const svgBuffer = await readFile(SRC_SVG);

  await Promise.all(
    SIZES.map(async (size) => {
      const out = resolve(OUT_DIR, `icon-${size}.png`);
      const preRendered = resolve(
        PRERENDERED_DIR,
        `xt-toolkit-rounded-square-xt-${size}.png`,
      );
      if (existsSync(preRendered)) {
        await copyFile(preRendered, out);
        console.log(`  ✓ ${out.replace(ROOT + '/', '')}  (kopie z icons/)`);
        return;
      }
      await sharp(svgBuffer, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(out);
      console.log(`  ✓ ${out.replace(ROOT + '/', '')}  (z SVG)`);
    }),
  );

  // Zkopíruj SVG pro použití v Options stránce.
  await copyFile(SRC_SVG, resolve(OUT_DIR, 'icon.svg'));
  console.log(`  ✓ public/icons/icon.svg`);
}

main().catch((err) => {
  console.error('Chyba při generování ikon:', err);
  process.exit(1);
});
