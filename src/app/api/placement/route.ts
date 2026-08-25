import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domainSlug = searchParams.get('domain');

    if (!domainSlug) {
      return NextResponse.json({ error: 'Domain slug required' }, { status: 400 });
    }

    const domain = await prisma.domain.findUnique({
      where: { slug: domainSlug },
      include: {
        placementTests: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!domain || domain.placementTests.length === 0) {
      return NextResponse.json({ error: 'Test de placement non trouvé' }, { status: 404 });
    }

    const test = domain.placementTests[0];
    return NextResponse.json({
      testId: test.id,
      title: test.title,
      description: test.description,
      domainId: domain.id,
      domainName: domain.name,
      questions: test.questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: JSON.parse(q.options),
        points: q.points,
      })),
    });
  } catch (error) {
    console.error('Error fetching placement test:', error);
    return NextResponse.json({ error: 'Failed to fetch placement test' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domainId, testId, userAnswers } = body; // userAnswers: { questionId: selectedOption }

    const test = await prisma.placementTest.findUnique({
      where: { id: testId },
      include: { questions: true },
    });

    if (!test) {
      return NextResponse.json({ error: 'Placement test not found' }, { status: 404 });
    }

    let earnedPoints = 0;
    let maxPoints = 0;

    test.questions.forEach((q) => {
      maxPoints += q.points;
      if (userAnswers[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });

    const pct = Math.round((earnedPoints / maxPoints) * 100);

    // Calculate level (1: 0-39%, 2: 40-59%, 3: 60-79%, 4: 80-89%, 5: 90-100%)
    let assignedLevel = 1;
    if (pct >= 90) assignedLevel = 5;
    else if (pct >= 80) assignedLevel = 4;
    else if (pct >= 60) assignedLevel = 3;
    else if (pct >= 40) assignedLevel = 2;

    // Save placement result
    const result = await prisma.placementResult.create({
      data: {
        userId: 'default-user',
        domainId,
        placementTestId: testId,
        score: pct,
        assignedLevel,
      },
    });

    return NextResponse.json({
      resultId: result.id,
      score: pct,
      assignedLevel,
      earnedPoints,
      maxPoints,
    });
  } catch (error) {
    console.error('Error submitting placement test:', error);
    return NextResponse.json({ error: 'Failed to evaluate placement test' }, { status: 500 });
  }
}
