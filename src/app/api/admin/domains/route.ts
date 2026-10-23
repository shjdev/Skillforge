import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { DomainSchema } from '@/lib/schemas/admin.schema';
import { getSessionContext } from '@/lib/serverAuth';
import { resolveNewOwnerId } from '@/lib/ownership';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Un non-admin crée toujours une ressource personnelle, quel que soit le
    // drapeau `personal` envoyé par le client.
    const session = await getSessionContext();
    const userId = resolveNewOwnerId(session, Boolean(body?.personal));
    const isPersonal = userId !== null;

    const validatedData = DomainSchema.parse(body);

    let slug = validatedData.slug;
    const existing = await prisma.domain.findUnique({ where: { slug } });
    if (existing) {
      if (isPersonal && existing.ownerId === userId) {
        return NextResponse.json(existing, { status: 200 });
      }
      if (isPersonal && userId) {
        const suffix = userId.replace(/^user-/, '').slice(0, 8) || 'perso';
        slug = `${slug}-${suffix}`;
        const existingScoped = await prisma.domain.findUnique({ where: { slug } });
        if (existingScoped && existingScoped.ownerId === userId) {
          return NextResponse.json(existingScoped, { status: 200 });
        }
        if (existingScoped) {
          slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }
      }
    }

    const domain = await prisma.domain.create({
      data: {
        name: validatedData.name,
        slug,
        description: validatedData.description,
        icon: validatedData.icon,
        color: validatedData.color,
        order: validatedData.order,
        isActive: validatedData.isActive,
        ownerId: userId,
      },
    });

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error('Error creating domain:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
