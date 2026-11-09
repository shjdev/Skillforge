import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';
import { profileView } from '@/lib/profile';
import { errorResponse } from '@/lib/http';


export async function GET() {
  try {
    const { userId, isAdmin } = await getSessionContext();
    return NextResponse.json(await profileView(userId, isAdmin));
  } catch (err) {
    return errorResponse(err);
  }
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide.');
const updateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(60).optional(),
  sessionMode: z.enum(['TWO_SESSIONS', 'ONE_SESSION']).optional(),
  morningTime: time.optional(),
  eveningTime: time.optional(),
  singleSessionTime: time.optional(),
  reminders: z.boolean().optional(),
});

export async function PUT(request: Request) {
  try {
    const { userId, isAdmin } = await getSessionContext();
    await ensureUserProfile(userId);
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Champs invalides.' }, { status: 400 });
    }
    const { reminders, ...fields } = parsed.data;
    await prisma.userProfile.update({
      where: { id: userId },
      data: {
        ...fields,
        ...(reminders !== undefined
          ? { notificationSettings: { upsert: { create: { desktopEnabled: reminders }, update: { desktopEnabled: reminders } } } }
          : {}),
      },
    });
    return NextResponse.json(await profileView(userId, isAdmin));
  } catch (err) {
    return errorResponse(err);
  }
}
