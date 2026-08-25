import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { QuizSchema } from '@/lib/schemas/admin.schema';

export async function GET() {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        topic: { select: { id: true, name: true, domain: { select: { name: true } } } },
        questions: { orderBy: { questionText: 'asc' } },
        _count: { select: { questions: true, quizAttempts: true } },
      },
      orderBy: [{ topic: { domain: { order: 'asc' } } }, { title: 'asc' }],
    });
    return NextResponse.json({ quizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return NextResponse.json({ error: 'Échec du chargement des quiz' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = QuizSchema.parse(body);

    const topic = await prisma.topic.findUnique({ where: { id: validatedData.topicId } });
    if (!topic) {
      return NextResponse.json({ error: 'Thème introuvable' }, { status: 404 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        topicId: validatedData.topicId,
        title: validatedData.title,
        passingScore: validatedData.passingScore,
        quizType: validatedData.quizType,
      },
    });

    return NextResponse.json(quiz, { status: 201 });
  } catch (error) {
    console.error('Error creating quiz:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
