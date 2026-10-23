import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { DomainSchema } from '@/lib/schemas/admin.schema';
import { getSessionContext } from '@/lib/serverAuth';
import { canWrite } from '@/lib/ownership';

const FORBIDDEN_MESSAGE = 'Vous ne pouvez modifier que les domaines que vous avez vous-même créés.';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionContext();

    const existing = await prisma.domain.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 });
    }
    if (!canWrite(session, existing.ownerId)) {
      return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = DomainSchema.parse(body);

    const domain = await prisma.domain.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(domain);
  } catch (error) {
    console.error('Error updating domain:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionContext();

    const existing = await prisma.domain.findUnique({ where: { id }, select: { ownerId: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 });
    }
    if (!canWrite(session, existing.ownerId)) {
      return NextResponse.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    }

    // The active-domain lock is a loose reference (no FK) — clear it for every
    // profile locked on this domain, otherwise they stay stuck on a domain
    // that no longer exists.
    await prisma.userProfile.updateMany({
      where: { currentActiveDomainId: id },
      data: { currentActiveDomainId: null, currentActiveTopicId: null },
    });

    await prisma.domain.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({ error: 'Échec de la suppression du domaine' }, { status: 500 });
  }
}
