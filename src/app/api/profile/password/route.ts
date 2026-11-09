import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAuthEnabled } from '@/lib/authGate';
import { MIN_PERSONAL_PASSWORD_LENGTH, hashPassword, verifyPassword } from '@/lib/personalPassword';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';

const bodySchema = z.object({ current: z.string().max(200), next: z.string().max(200) });

/** Change le mot de passe personnel d'un testeur (l'actuel est exigé). */
export async function POST(request: Request) {
  try {
    const { userId, isAdmin } = await getSessionContext();
    if (!isAuthEnabled() || isAdmin) {
      return NextResponse.json({ error: 'Aucun mot de passe personnel pour ce compte.' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Champs invalides.' }, { status: 400 });
    const { current, next } = parsed.data;

    const credential = await prisma.userCredential.findUnique({ where: { userId } });
    if (!credential || !verifyPassword(current, credential.passwordHash)) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 401 });
    }
    if (next.length < MIN_PERSONAL_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Le nouveau mot de passe doit faire au moins ${MIN_PERSONAL_PASSWORD_LENGTH} caractères.` },
        { status: 400 },
      );
    }
    await prisma.userCredential.update({ where: { userId }, data: { passwordHash: hashPassword(next) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
