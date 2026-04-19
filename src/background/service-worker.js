/**
 * Service worker rozšíření. V MV3 musí existovat jako ES modul.
 * Otevírá stránku „Možnosti nastavení" při kliknutí na ikonu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

chrome.action.onClicked?.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
