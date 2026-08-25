import { z } from 'zod';

// Schéma pour les Domaines
// Note: pas de .default() ici — @hookform/resolvers/zod avec zod v4 infère le type
// d'entrée (pré-défauts) pour useForm, ce qui rend ces champs optionnels et casse le
// typage de handleSubmit. Les valeurs par défaut sont fournies via useForm({defaultValues}).
export const DomainSchema = z.object({
  name: z.string().min(3, "Le nom du domaine est trop court"),
  slug: z.string().min(2, "Le slug est obligatoire"),
  description: z.string().min(10, "La description doit faire au moins 10 caractères"),
  icon: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format de couleur invalide (ex: #3b82f6)"),
  order: z.number().int().min(1),
  isActive: z.boolean(),
});

export type DomainFormData = z.infer<typeof DomainSchema>;

// Schéma pour les Thèmes (Topics)
export const TopicSchema = z.object({
  domainId: z.string().min(1, "Le domaine est invalide"),
  name: z.string().min(3, "Le nom du thème est trop court"),
  slug: z.string().min(2, "Le slug est obligatoire"),
  description: z.string().min(10, "La description doit faire au moins 10 caractères"),
  maxDifficultyLevel: z.number().int().min(1).max(5),
  estimatedWeeks: z.number().int().min(1),
  prerequisites: z.array(z.string()),
});

export type TopicFormData = z.infer<typeof TopicSchema>;

// Schéma pour les Leçons (Lessons)
export const LessonSchema = z.object({
  topicId: z.string().min(1, "Le thème est invalide"),
  title: z.string().min(3, "Le titre de la leçon est trop court"),
  contentMd: z.string().min(20, "Le contenu de la leçon est obligatoire"),
  dayNumber: z.number().int().min(1).max(30),
  sessionType: z.enum(["MORNING", "EVENING", "FULL_DAY"]),
  difficultyLevel: z.number().int().min(1).max(5),
  durationMinutes: z.number().int().min(5),
  keyConcepts: z.array(z.string()),
  bookReferenceId: z.string().min(1).optional().nullable(),
  chapterCitation: z.string().optional().nullable(),
});

export type LessonFormData = z.infer<typeof LessonSchema>;

// Schéma pour les Quiz
export const QuizSchema = z.object({
  topicId: z.string().min(1, "Le thème est invalide"),
  title: z.string().min(3, "Le titre du quiz est trop court"),
  passingScore: z.number().int().min(1).max(100),
  quizType: z.enum(["WEEKLY", "PLACEMENT"]),
});

export type QuizFormData = z.infer<typeof QuizSchema>;

// Schéma pour les Questions de quiz
export const QuestionSchema = z.object({
  questionText: z.string().min(5, "La question est trop courte"),
  options: z.array(z.string()).min(2, "Au moins deux réponses sont requises"),
  correctAnswer: z.string().min(1, "La réponse correcte est obligatoire"),
  explanation: z.string().optional(),
  points: z.number().int().min(1).max(100),
});

export type QuestionFormData = z.infer<typeof QuestionSchema>;
