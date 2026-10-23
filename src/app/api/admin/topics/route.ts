import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { TopicSchema } from '@/lib/schemas/admin.schema';
import { getSessionContext } from '@/lib/serverAuth';
import { canRead, resolveNewOwnerId } from '@/lib/ownership';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Un non-admin crée toujours une ressource personnelle, quel que soit le
    // drapeau `personal` envoyé par le client.
    const session = await getSessionContext();
    const userId = resolveNewOwnerId(session, Boolean(body?.personal));
    const isPersonal = userId !== null;

    const validatedData = TopicSchema.parse(body);

    const domain = await prisma.domain.findUnique({
      where: { id: validatedData.domainId },
      select: { ownerId: true },
    });
    if (!domain || !canRead(session, domain.ownerId)) {
      return NextResponse.json({ error: 'Domaine introuvable' }, { status: 404 });
    }

    let slug = validatedData.slug;
    const existing = await prisma.topic.findUnique({ where: { slug } });
    if (existing) {
      if (isPersonal && existing.ownerId === userId) {
        return NextResponse.json(existing, { status: 200 });
      }
      if (isPersonal && userId) {
        const suffix = userId.replace(/^user-/, '').slice(0, 8) || 'perso';
        slug = `${slug}-${suffix}`;
        const existingScoped = await prisma.topic.findUnique({ where: { slug } });
        if (existingScoped && existingScoped.ownerId === userId) {
          return NextResponse.json(existingScoped, { status: 200 });
        }
        if (existingScoped) {
          slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        }
      }
    }

    const topic = await prisma.topic.create({
      data: {
        domainId: validatedData.domainId,
        name: validatedData.name,
        slug,
        description: validatedData.description,
        maxDifficultyLevel: validatedData.maxDifficultyLevel,
        estimatedWeeks: validatedData.estimatedWeeks,
        prerequisites: JSON.stringify(validatedData.prerequisites),
        ownerId: userId,
      },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    console.error('Error creating topic:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
