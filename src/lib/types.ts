export interface Resource {
  title: string;
  url: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number; // index of the correct option
  explanation?: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  key_takeaways: string[];
  resources: Resource[];
  quiz: QuizQuestion[];
  estimated_minutes: number;
  sort_order: number;
}

export interface Module {
  id: string;
  department_id: string;
  slug: string;
  title: string;
  overview: string | null;
  sort_order: number;
  is_prerequisite?: boolean;
  lessons: Lesson[];
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  difficulty: string | null;
  estimated_hours: number | null;
  what_youll_learn: string[];
  prerequisites: string[];
  tools: string[];
  sources: Resource[];
  accent: string;
  icon: string;
  sort_order: number;
  modules?: Module[];
}

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  team_number: number | null;
  bio: string | null;
  role: string;
  xp: number;
  hide_name: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  criteria: Record<string, unknown>;
  sort_order: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement?: Achievement;
}

/** A lesson flattened with the context needed for navigation / progress. */
export interface FlatLesson extends Lesson {
  moduleTitle: string;
  moduleSlug: string;
  departmentSlug: string;
  departmentName: string;
}
