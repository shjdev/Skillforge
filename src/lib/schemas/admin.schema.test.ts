import { describe, it, expect } from 'vitest';
import { DomainSchema, TopicSchema, LessonSchema, QuizSchema, QuestionSchema } from './admin.schema';

describe('DomainSchema', () => {
  const valid = {
    name: 'Informatique',
    slug: 'informatique',
    description: 'Un domaine de test suffisamment long',
    icon: 'BookOpen',
    color: '#3b82f6',
    order: 1,
    isActive: true,
  };

  it('accepts a valid domain', () => {
    expect(DomainSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a name that is too short', () => {
    const result = DomainSchema.safeParse({ ...valid, name: 'Ab' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid hex color', () => {
    const result = DomainSchema.safeParse({ ...valid, color: 'blue' });
    expect(result.success).toBe(false);
  });

  it('rejects a description that is too short', () => {
    const result = DomainSchema.safeParse({ ...valid, description: 'court' });
    expect(result.success).toBe(false);
  });
});

describe('TopicSchema', () => {
  const valid = {
    domainId: 'domain-1',
    name: 'Réseaux',
    slug: 'reseaux',
    description: 'Description suffisamment longue pour être valide',
    maxDifficultyLevel: 5,
    estimatedWeeks: 4,
    prerequisites: [],
  };

  it('accepts a valid topic', () => {
    expect(TopicSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a difficulty level above 5', () => {
    expect(TopicSchema.safeParse({ ...valid, maxDifficultyLevel: 6 }).success).toBe(false);
  });

  it('rejects an empty domainId', () => {
    expect(TopicSchema.safeParse({ ...valid, domainId: '' }).success).toBe(false);
  });
});

describe('LessonSchema', () => {
  const valid = {
    topicId: 'topic-1',
    title: 'Introduction au chiffrement',
    contentMd: 'Contenu de la leçon avec suffisamment de caractères pour passer.',
    dayNumber: 1,
    sessionType: 'MORNING' as const,
    difficultyLevel: 2,
    durationMinutes: 30,
    keyConcepts: ['Chiffrement symétrique'],
  };

  it('accepts a valid lesson', () => {
    expect(LessonSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid sessionType', () => {
    const result = LessonSchema.safeParse({ ...valid, sessionType: 'AFTERNOON' });
    expect(result.success).toBe(false);
  });

  it('rejects a dayNumber above 30', () => {
    expect(LessonSchema.safeParse({ ...valid, dayNumber: 31 }).success).toBe(false);
  });

  it('accepts an omitted bookReferenceId', () => {
    expect(LessonSchema.safeParse(valid).success).toBe(true);
  });
});

describe('QuizSchema', () => {
  it('accepts a valid quiz', () => {
    const result = QuizSchema.safeParse({
      topicId: 'topic-1',
      title: 'Quiz hebdo',
      passingScore: 80,
      quizType: 'WEEKLY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a passingScore over 100', () => {
    const result = QuizSchema.safeParse({
      topicId: 'topic-1',
      title: 'Quiz hebdo',
      passingScore: 150,
      quizType: 'WEEKLY',
    });
    expect(result.success).toBe(false);
  });
});

describe('QuestionSchema', () => {
  const valid = {
    questionText: 'Quelle est la capitale ?',
    options: ['Paris', 'Londres'],
    correctAnswer: 'Paris',
    points: 10,
  };

  it('accepts a valid question', () => {
    expect(QuestionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects fewer than two options', () => {
    expect(QuestionSchema.safeParse({ ...valid, options: ['Paris'] }).success).toBe(false);
  });

  it('rejects a missing correctAnswer', () => {
    expect(QuestionSchema.safeParse({ ...valid, correctAnswer: '' }).success).toBe(false);
  });
});
