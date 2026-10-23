// Règles d'accès aux ressources partagées entre profils (Domain, Topic,
// BookReference, IngestJob). Fonctions pures, sans Prisma, pour être testables.
//
// - ownerId = null  → catalogue commun : lisible par tous, modifiable par l'admin seulement.
// - ownerId = <id>  → ressource personnelle : visible et modifiable par son propriétaire (et l'admin).

export interface AccessSession {
  userId: string;
  isAdmin: boolean;
}

/** Le profil peut-il voir cette ressource ? */
export function canRead(session: AccessSession, ownerId: string | null | undefined): boolean {
  if (session.isAdmin) return true;
  return !ownerId || ownerId === session.userId;
}

/** Le profil peut-il modifier, supprimer ou ajouter du contenu à cette ressource ? */
export function canWrite(session: AccessSession, ownerId: string | null | undefined): boolean {
  if (session.isAdmin) return true;
  return !!ownerId && ownerId === session.userId;
}

/**
 * ownerId à attribuer à une ressource créée. Un non-admin crée toujours une
 * ressource personnelle, même sans le drapeau `personal` (qui vient du client).
 */
export function resolveNewOwnerId(session: AccessSession, requestedPersonal: boolean): string | null {
  if (!session.isAdmin) return session.userId;
  return requestedPersonal ? session.userId : null;
}
