import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteProfile, getAdminOverview, requireAdmin, resetPassword } from '@/lib/admin';
import { AppError } from '@/lib/app-error';
import { errorResponse } from '@/lib/http';

/** Profils et usage de la plateforme. */
export async function GET() {
  try {
    const { userId } = await requireAdmin();
    return NextResponse.json(await getAdminOverview(userId));
  } catch (err) {
    return errorResponse(err, 'Échec du chargement des profils.');
  }
}

const actionSchema = z.object({
  userId: z.string().min(1).max(200),
  action: z.enum(['reset-password', 'delete']),
});

/** Body : { userId, action: 'reset-password' | 'delete' } */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('Paramètres invalides.');
    const { userId, action } = parsed.data;
    if (action === 'reset-password') await resetPassword(userId);
    else await deleteProfile(admin.userId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'Action impossible.');
  }
}
