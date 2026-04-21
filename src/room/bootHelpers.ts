/**
 * Helper pro vypnutí pre-boot overlaye. Pre-boot je v v2.0.111+ čistě
 * CSS: Chrome vkládá `src/content/pre-boot.css` přes manifest, který
 * schovává obsah dokud na `<html>` není třída `xct-boot-done`. Tento
 * helper tu třídu přidá.
 *
 * Volá se z App.tsx (po prvním React commitu) i z mount.tsx (fallback
 * přes setTimeout), aby uživatel spinner viděl maximálně do vykreslení
 * Reactu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

let removed = false;

export const removePreBoot = (): void => {
  if (removed) return;
  removed = true;
  document.documentElement.classList.add('xct-boot-done');
  // Legacy cleanup – kdyby v DOMu zůstal starý JS overlay z předchozích
  // verzí, odstraníme ho (nevadí pokud není, jen bezpečnost).
  document.getElementById('xct-pre-boot')?.remove();
  document.getElementById('xct-pre-boot-style')?.remove();
};
