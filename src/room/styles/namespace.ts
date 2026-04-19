/**
 * Jmenný prostor našich CSS tříd. Prefix `xct-` = „xchat-toolkit".
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export const NAMESPACE = 'xct';
export const NAMESPACE_CLASS = `${NAMESPACE}-root`;
export const cls = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
