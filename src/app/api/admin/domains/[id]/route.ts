import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { DomainSchema } from '@/lib/schemas/admin.schema';
import { DEFAULT_USER_ID } from '@/lib/learning';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // The active-domain lock is a loose reference (no FK) — clear it if we're
    // deleting the domain it points to, otherwise the learner gets stuck locked
    // on a domain that no longer exists.
    const user = await prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } });
    if (user?.currentActiveDomainId === id) {
      await prisma.userProfile.update({
        where: { id: DEFAULT_USER_ID },
        data: { currentActiveDomainId: null, currentActiveTopicId: null },
      });
    }

    await prisma.domain.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({ error: 'Échec de la suppression du domaine' }, { status: 500 });
  }
}
