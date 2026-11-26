/** The Standards UI text components use this helper to join optional classes. */
export const cn = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');
