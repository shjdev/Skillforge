import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { QuestionSchema } from '@/lib/schemas/admin.schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = QuestionSchema.parse(body);

    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz introuvable' }, { status: 404 });
    }

    if (!validatedData.options.includes(validatedData.correctAnswer)) {
      return NextResponse.json(
        { error: "La réponse correcte doit faire partie des propositions." },
        { status: 400 }
      );
    }

    const question = await prisma.quizQuestion.create({
      data: {
        quizId: id,
        questionText: validatedData.questionText,
        options: JSON.stringify(validatedData.options),
        correctAnswer: validatedData.correctAnswer,
        explanation: validatedData.explanation || '',
        points: validatedData.points,
        questionType: 'MCQ',
      },
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
