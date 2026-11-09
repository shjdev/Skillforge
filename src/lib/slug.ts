/** « Réseaux & Protocoles » → « reseaux-protocoles ». */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
}

/** Slug libre parmi `taken` (ajoute -2, -3… si besoin) ; l'ajoute à `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'theme';
  let slug = root;
  for (let n = 2; taken.has(slug); n++) slug = `${root}-${n}`;
  taken.add(slug);
  return slug;
}
