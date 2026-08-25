// Design tokens extracted from the approved SkillForge redesign
// (Réponses formulaire écrans/SkillForge.dc.html). Two fixed visual
// identities — a light "editorial" theme for the learner space, a dark
// "control panel" theme for the admin space — sharing the same accent.

export const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const FONT_SERIF = "'Newsreader', Georgia, serif";

// Shared accents
export const EMBER = 'oklch(0.585 0.145 45)';
export const EMBER_HOVER = 'oklch(0.48 0.15 45)';
export const VERDANT = 'oklch(0.585 0.11 168)';
export const DANGER = 'oklch(0.62 0.13 30)';

// Learner theme (light paper)
export const L = {
  paper: 'oklch(0.963 0.008 85)',
  paper2: 'oklch(0.983 0.005 85)',
  paper3: 'oklch(0.951 0.008 85)',
  paperActive: 'oklch(0.975 0.010 70)',
  ink: 'oklch(0.235 0.014 60)',
  ink2: 'oklch(0.50 0.012 60)',
  ink3: 'oklch(0.66 0.010 60)',
  rule: 'oklch(0.885 0.012 78)',
  rule2: 'oklch(0.910 0.010 78)',
  rule3: 'oklch(0.80 0.012 78)',
  ruleFaint: 'oklch(0.82 0.012 78)',
  ruleFaint2: 'oklch(0.86 0.012 78)',
  ruleFaint3: 'oklch(0.87 0.012 78)',
};

// Admin theme (dark panel)
export const D = {
  bg: 'oklch(0.185 0.006 65)',
  panel: 'oklch(0.225 0.007 65)',
  panel2: 'oklch(0.205 0.007 65)',
  panel3: 'oklch(0.215 0.007 65)',
  border: 'oklch(0.32 0.008 65)',
  border2: 'oklch(0.28 0.007 65)',
  border3: 'oklch(0.40 0.008 65)',
  text: 'oklch(0.92 0.008 85)',
  heading: 'oklch(0.96 0.006 85)',
  text2: 'oklch(0.70 0.008 85)',
  text3: 'oklch(0.58 0.008 65)',
  text4: 'oklch(0.45 0.008 65)',
};

export function formatPoints(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Display swatches (oklch, for the picker UI) paired 1:1 with the hex value
// actually persisted (Domain.color is validated as #rrggbb server-side).
export const DOMAIN_SWATCHES = [
  { display: EMBER, hex: '#ef4444' },
  { display: VERDANT, hex: '#10b981' },
  { display: 'oklch(0.585 0.11 250)', hex: '#3b82f6' },
  { display: 'oklch(0.585 0.13 330)', hex: '#ec4899' },
  { display: 'oklch(0.585 0.10 95)', hex: '#eab308' },
  { display: 'oklch(0.60 0.005 65)', hex: '#6b7280' },
];
