import { cn } from '@/lib/utils';

/**
 * Signature discrète de l'auteur (kit logo SHJ « Signal », v1.0).
 * Règles du guide : couleurs d'origine, jamais déformé ni recoloré,
 * coupe « petit » sous 32 px.
 */
export function ShjSignature({ className }: { className?: string }) {
  return (
    <span
      title="SkillForge — un projet de SAMAN Hugues Junior (SHJ)"
      className={cn('inline-flex items-center gap-2 text-ink-3', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique minuscule, pas d'optimisation utile */}
      <img src="/brand/shj-symbole-petit-couleur.svg" alt="" width={18} height={18} className="size-[18px]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Un projet SHJ</span>
    </span>
  );
}

/** Symbole SHJ seul, plus grand (page de connexion). */
export function ShjMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG statique
    <img
      src={size < 32 ? '/brand/shj-symbole-petit-couleur.svg' : '/brand/shj-symbole-couleur.svg'}
      alt="Logo SHJ"
      width={size}
      height={size}
      className={className}
    />
  );
}
