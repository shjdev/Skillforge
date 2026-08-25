import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID, XP_PER_QUIZ_PASS } from '@/lib/learning';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const { answers } = await request.json();

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true, topic: true },
    });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz introuvable' }, { status: 404 });
    }

    let earnedPoints = 0;
    let maxPoints = 0;
    quiz.questions.forEach((q) => {
      maxPoints += q.points;
      if (answers?.[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });
    const percentage = maxPoints ? Math.round((earnedPoints / maxPoints) * 100) : 0;
    const passed = percentage >= quiz.passingScore;

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: DEFAULT_USER_ID,
        quizId: quiz.id,
        score: earnedPoints,
        maxScore: maxPoints,
        percentage,
        passed,
        answers: JSON.stringify(answers || {}),
      },
    });

    if (passed) {
      await prisma.userProgress.upsert({
        where: { userId_topicId: { userId: DEFAULT_USER_ID, topicId: quiz.topicId } },
        update: { status: 'COMPLETED', completionPct: 100, completedAt: new Date() },
        create: {
          userId: DEFAULT_USER_ID,
          topicId: quiz.topicId,
          status: 'COMPLETED',
          completionPct: 100,
          completedAt: new Date(),
        },
      });

      const user = await prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } });
      if (user) {
        await prisma.userProfile.update({
          where: { id: DEFAULT_USER_ID },
          data: {
            totalXp: user.totalXp + XP_PER_QUIZ_PASS,
            // Unlock: this topic/domain is done, the learner may now pick a new one.
            currentActiveDomainId: user.currentActiveTopicId === quiz.topicId ? null : user.currentActiveDomainId,
            currentActiveTopicId: user.currentActiveTopicId === quiz.topicId ? null : user.currentActiveTopicId,
          },
        });
      }
    }

    return NextResponse.json({
      attemptId: attempt.id,
      score: earnedPoints,
      maxScore: maxPoints,
      percentage,
      passingScore: quiz.passingScore,
      passed,
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json({ error: 'Échec de la soumission du quiz' }, { status: 500 });
  }
}
