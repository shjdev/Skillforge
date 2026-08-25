import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { TopicSchema } from '@/lib/schemas/admin.schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = TopicSchema.parse(body);

    const topic = await prisma.topic.create({
      data: {
        domainId: validatedData.domainId,
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        maxDifficultyLevel: validatedData.maxDifficultyLevel,
        estimatedWeeks: validatedData.estimatedWeeks,
        prerequisites: JSON.stringify(validatedData.prerequisites),
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
