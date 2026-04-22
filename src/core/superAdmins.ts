/**
 * Seznam super-administrátorů rozšíření XChat Toolkit.
 *
 * Sdílená konstanta používaná napříč rozšířením – rozhoduje o tom, kdo
 * má jako "superadmin" vyšší limit na délku zprávy, přístup k záložce
 * „Správa" v místnosti a případné další privilegované funkce. Porovnává
 * se case-insensitive proti vlastnímu nicku přihlášeného uživatele.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export const SUPER_ADMINS: readonly string[] = ['GymJWM', 'Prazdroj', 'Prazdrojka'];

/** Je daný nick v seznamu {@link SUPER_ADMINS}? Case-insensitive. */
export const isSuperAdmin = (nick: string | null | undefined): boolean => {
  if (!nick) return false;
  const needle = nick.toLowerCase();
  return SUPER_ADMINS.some((n) => n.toLowerCase() === needle);
};
