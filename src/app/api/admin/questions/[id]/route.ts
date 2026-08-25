import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { QuestionSchema } from '@/lib/schemas/admin.schema';

const QuestionUpdateSchema = QuestionSchema.partial();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = QuestionUpdateSchema.parse(body);

    if (validatedData.options && validatedData.correctAnswer && !validatedData.options.includes(validatedData.correctAnswer)) {
      return NextResponse.json(
        { error: "La réponse correcte doit faire partie des propositions." },
        { status: 400 }
      );
    }

    const question = await prisma.quizQuestion.update({
      where: { id },
      data: {
        ...(validatedData.questionText !== undefined ? { questionText: validatedData.questionText } : {}),
        ...(validatedData.options !== undefined ? { options: JSON.stringify(validatedData.options) } : {}),
        ...(validatedData.correctAnswer !== undefined ? { correctAnswer: validatedData.correctAnswer } : {}),
        ...(validatedData.explanation !== undefined ? { explanation: validatedData.explanation } : {}),
        ...(validatedData.points !== undefined ? { points: validatedData.points } : {}),
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
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
    await prisma.quizQuestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ error: 'Échec de la suppression de la question' }, { status: 500 });
  }
}
