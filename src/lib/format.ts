/** Formats d'affichage partagés (français). */

export function formatPoints(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "1 leçon", "3 leçons" — le pluriel ajoute un s au mot donné. */
export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count > 1 ? pluralWord : word}`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}
