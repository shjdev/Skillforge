import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { DEFAULT_USER_ID } from './learning';
import {
  AUTH_COOKIE_NAME,
  USER_COOKIE_NAME,
  isAdminPasswordEnabled,
  isAuthEnabled,
  normalizeProfileId,
  parseSessionToken,
} from './authGate';

export interface SessionContext {
  userId: string;
  isAdmin: boolean;
}

export async function getSessionContext(): Promise<SessionContext> {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const parsed = parseSessionToken(token);
      if (parsed.valid) {
        return { userId: parsed.userId, isAdmin: parsed.isAdmin };
      }
    }
    const localUser = store.get(USER_COOKIE_NAME)?.value;
    if (localUser) {
      return {
        userId: normalizeProfileId(localUser),
        isAdmin: !isAdminPasswordEnabled(),
      };
    }
  } catch {
    // Fallback when called outside a request context (e.g. unit tests)
  }
  return {
    userId: DEFAULT_USER_ID,
    isAdmin: !isAuthEnabled() || !isAdminPasswordEnabled(),
  };
}

export async function getCurrentUserId(): Promise<string> {
  const ctx = await getSessionContext();
  return ctx.userId;
}

export function formatDefaultName(userId: string): string {
  if (userId === DEFAULT_USER_ID) return 'Apprenant SkillForge';
  const raw = userId.replace(/^user-/, '').replace(/-/g, ' ');
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Apprenant';
}

export async function ensureUserProfile(userId: string, preferredName?: string) {
  let user = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: { notificationSettings: true },
  });

  if (!user) {
    user = await createProfile(userId, preferredName);
  } else if (preferredName?.trim() && user.name === formatDefaultName(userId)) {
    user = await prisma.userProfile.update({
      where: { id: userId },
      data: { name: preferredName.trim() },
      include: { notificationSettings: true },
    });
  }

  return user;
}

/** Crée le profil ; si une requête parallèle l'a créé entre-temps, le relit. */
async function createProfile(userId: string, preferredName?: string) {
  try {
    return await prisma.userProfile.create({
      data: {
        id: userId,
        name: preferredName?.trim() || formatDefaultName(userId),
        sessionMode: 'TWO_SESSIONS',
        morningTime: '07:30',
        eveningTime: '20:00',
        notificationSettings: {
          create: {
            desktopEnabled: true,
            soundEnabled: true,
            morningReminderMins: 5,
            eveningReminderMins: 5,
            accumulationReminder: true,
            streakReminder: true,
          },
        },
      },
      include: { notificationSettings: true },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err;
    return prisma.userProfile.findUniqueOrThrow({ where: { id: userId }, include: { notificationSettings: true } });
  }
}
