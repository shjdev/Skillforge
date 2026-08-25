// Lightweight client-side shapes matching the JSON returned by the API routes.
// Not a 1:1 mirror of the Prisma models — only the fields the UI actually reads.

export interface BookReferenceInfo {
  id: string;
  title: string;
  author: string;
}

export interface LessonInfo {
  id: string;
  topicId: string;
  title: string;
  contentMd: string;
  dayNumber: number;
  sessionType: 'MORNING' | 'EVENING' | 'FULL_DAY';
  difficultyLevel: number;
  durationMinutes: number;
  keyConcepts: string;
  chapterCitation: string | null;
  bookReference: BookReferenceInfo | null;
}

export interface PlacementResultInfo {
  id: string;
  assignedLevel: number;
  score: number;
}

export interface UserProgressInfo {
  id: string;
  topicId: string;
  status: string;
  completionPct: number;
  currentDay: number;
}

export interface TopicSummary {
  id: string;
  domainId: string;
  name: string;
  slug: string;
  description: string;
  estimatedWeeks: number;
  maxDifficultyLevel: number;
  lessons?: LessonInfo[];
  userProgresses?: UserProgressInfo[];
}

export interface DomainSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  topics: TopicSummary[];
  placementResults?: PlacementResultInfo[];
}

export interface QuizQuestionOption {
  id: string;
  questionText: string;
  options: string[];
  points: number;
}

export interface PlacementTestInfo {
  testId: string;
  title: string;
  description: string;
  domainId: string;
  domainName: string;
  questions: QuizQuestionOption[];
}

export interface TopicDetailResponse {
  topic: {
    id: string;
    name: string;
    slug: string;
    description: string;
    estimatedWeeks: number;
    domain: { id: string; name: string; slug: string; color: string };
  };
  progress: {
    currentDay: number;
    currentWeek: number;
    status: string;
    completionPct: number;
    totalLessons: number;
    completedLessons: number;
  };
  activeLesson: LessonInfo | null;
  allLessonsCompleted: boolean;
  quiz: { id: string; title: string; passingScore: number; questions: QuizQuestionOption[] } | null;
  quizAttempt: { id: string; percentage: number; passed: boolean } | null;
}

// Raw Lesson row shape as returned by /api/admin/courses (lessons: true, no
// bookReference join — unlike LessonInfo which is joined for the learner view).
export interface AdminLessonRow {
  id: string;
  topicId: string;
  title: string;
  contentMd: string;
  dayNumber: number;
  sessionType: 'MORNING' | 'EVENING' | 'FULL_DAY';
  difficultyLevel: number;
  durationMinutes: number;
  keyConcepts: string;
  contentSource: string;
  bookReferenceId: string | null;
  chapterCitation: string | null;
}

export interface CourseTopic {
  id: string;
  name: string;
  prerequisites?: string; // JSON string of topic ids
  lessons: AdminLessonRow[];
}

export interface CourseDomain {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  topics: CourseTopic[];
}

export interface UserProgressWithTopic {
  id: string;
  status: string;
  completionPct: number;
  topic: { name: string; domain: { name: string } };
}

export interface PlacementResultWithDomain {
  id: string;
  assignedLevel: number;
  score: number;
  domain: { name: string };
}

export interface QuizAttemptWithQuiz {
  id: string;
  percentage: number;
  passed: boolean;
  quiz: { title: string };
}

export interface AdminUserOverview {
  user: {
    id: string;
    name: string;
    sessionMode: 'TWO_SESSIONS' | 'ONE_SESSION';
    morningTime: string;
    eveningTime: string;
    singleSessionTime: string;
    totalXp: number;
    currentStreak: number;
    currentActiveDomainId: string | null;
    progresses: UserProgressWithTopic[];
    placementResults: PlacementResultWithDomain[];
    quizAttempts: QuizAttemptWithQuiz[];
  };
  completedSessionsCount: number;
}
