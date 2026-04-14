/**
 * SmartSoma API Client
 * Typed fetch wrapper pointing at the FastAPI backend.
 * All methods that require auth read the JWT from localStorage automatically.
 */

import { getToken } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: "student" | "teacher";
  user_id: number;
  full_name: string;
  school_id: string | null;
}

export interface UserOut {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  grade_level: string | null;
  school_id: string | null;
  created_at: string;
}

export interface RecommendedMaterial {
  material_id: number;
  title: string;
  description: string | null;
  subject: string;
  competency_name: string;
  grade_level: string;
  difficulty_level: string;
  content_type: string | null;
  duration_minutes: number | null;
  file_url: string | null;
  file_path: string | null;  // local static path, e.g. /static/materials/math/s1/foo.pdf
  extracted_text: string | null;
  extraction_status: "pending" | "done" | "failed" | null;
  confidence_score: number;
  current_mastery: number;
}

export interface MasteryEntry {
  competency_name: string;
  mastery_score: number;
  last_updated: string;
}

export interface RecentInteraction {
  material_title: string;
  subject: string;
  quiz_score: number | null;
  time_spent_seconds: number | null;
  timestamp: string;
}

export interface StudentProgressOut {
  user_id: number;
  full_name: string;
  grade_level: string | null;
  overall_mastery: number;
  total_interactions: number;
  competency_mastery: MasteryEntry[];
  recent_interactions: RecentInteraction[];
}

export interface StudentSummary {
  user_id: number;
  full_name: string;
  grade_level: string | null;
  overall_mastery: number;
  total_interactions: number;
}

export interface CompetencyHeatmapRow {
  competency_name: string;
  grade_level: string;
  avg_mastery: number;
  student_count: number;
}

export interface ClassAnalyticsOut {
  total_students: number;
  total_materials: number;
  total_interactions: number;
  students: StudentSummary[];
  competency_heatmap: CompetencyHeatmapRow[];
}

export interface MaterialOut {
  material_id: number;
  title: string;
  description: string | null;
  subject: string;
  competency_id: number;
  competency_name: string;
  grade_level: string | null;
  difficulty_level: string;
  content_type: string | null;
  duration_minutes: number | null;
  file_url: string | null;
  file_path: string | null;
  extracted_text: string | null;
  extraction_status: "pending" | "done" | "failed" | null;
  extraction_error: string | null;
}

export interface PagedMaterials {
  items: MaterialOut[];
  total: number;
  skip: number;
  limit: number;
}

export interface CompetencyOut {
  competency_id: number;
  competency_name: string;
  grade_level: string;
  subject: string | null;
}

export interface TestResultEntry {
  competency_name: string;
  score: number; // 0–100
}

export interface TestUploadResponse {
  updated: number;
  skipped: number;
  new_overall_mastery: number;
  updated_competencies: MasteryEntry[];
}

export interface SystemStats {
  students: number;
  materials: number;
  interactions: number;
  competencies: number;
}

export interface MaterialPreviewResponse {
  title: string | null;
  description: string | null;
  subject: string | null;
  competency_name: string | null;
  grade_level: string | null;
  difficulty_level: string | null;
  content_type: string | null;
  duration_minutes: number | null;
  file_url: string;
  link_type: "youtube" | "pdf" | "webpage";
}

export interface MaterialCreate {
  title: string;
  description?: string;
  file_url?: string;
  subject: string;
  competency_id: number;
  difficulty_level: string;
  content_type?: string;
  duration_minutes?: number;
  extract_content?: boolean;
}

export interface MaterialUpdate {
  title?: string;
  description?: string;
  file_url?: string;
  subject?: string;
  competency_id?: number;
  difficulty_level?: string;
  content_type?: string;
  duration_minutes?: number;
}

export interface AIQuizQuestion {
  text: string;
  options: string[];
  correct: number;
}

export interface SubjectGradeEntry {
  subject: string;
  grade: number; // 0–100
}

export interface SubjectGradeOut {
  subject: string;
  grade: number;
  last_updated: string;
}

export interface SubjectGradeUploadResponse {
  saved: number;
  subject_grades: SubjectGradeOut[];
}

export interface TopicGradeEntry {
  subject: string;
  grade: number; // 0–100
  competency_id?: number | null;
  topic?: string | null;
}

export interface TopicGradeOut {
  id: number;
  subject: string;
  grade: number;
  competency_id: number | null;
  topic: string | null;
  last_updated: string;
}

export interface TopicGradeUploadResponse {
  saved: number;
  topic_grades: TopicGradeOut[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;

/** Clear localStorage auth state and hard-navigate to login. */
function handleSessionExpired(): never {
  localStorage.removeItem("smartsoma_token");
  localStorage.removeItem("smartsoma_user");
  document.cookie = "smartsoma_auth=; path=/; max-age=0";
  window.location.href = "/login";
  // throw so TypeScript knows this path never returns a value
  throw new Error("Session expired");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timeoutMs =
    typeof (options as { timeoutMs?: number }).timeoutMs === "number"
      ? (options as { timeoutMs?: number }).timeoutMs!
      : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Token was in localStorage but has expired — redirect before the request
  if (!token && typeof window !== "undefined" && localStorage.getItem("smartsoma_token")) {
    handleSessionExpired();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err instanceof Error ? err : new Error("Network error");
  } finally {
    clearTimeout(timeoutId);
  }

  // 401 from the backend means the token is invalid or expired on the server side
  if (res.status === 401) {
    handleSessionExpired();
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `HTTP ${res.status}`);
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || res.statusText || `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return (res.text() as unknown) as T;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    grade_level?: string;
    school_name?: string;
  }) => request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<UserOut>("/api/auth/me"),
};

// ─── Recommendations ─────────────────────────────────────────────────────────

export const recommendApi = {
  get: (limit = 5, subject?: string) =>
    request<RecommendedMaterial[]>("/api/recommend", {
      method: "POST",
      body: JSON.stringify({ limit, subject: subject ?? null }),
    }),
};

// ─── Students ────────────────────────────────────────────────────────────────

export const studentApi = {
  myProgress: () => request<StudentProgressOut>("/api/students/me/progress"),
  studentProgress: (id: number) =>
    request<StudentProgressOut>(`/api/students/${id}/progress`),
  uploadResults: (results: TestResultEntry[]) =>
    request<TestUploadResponse>("/api/students/me/upload-results", {
      method: "POST",
      body: JSON.stringify({ results }),
    }),

  uploadSubjectGrades: (grades: SubjectGradeEntry[]) =>
    request<SubjectGradeUploadResponse>("/api/students/me/subject-grades", {
      method: "POST",
      body: JSON.stringify({ grades }),
    }),

  getSubjectGrades: () =>
    request<SubjectGradeOut[]>("/api/students/me/subject-grades"),

  uploadTopicGrades: (grades: TopicGradeEntry[]) =>
    request<TopicGradeUploadResponse>("/api/students/me/topic-grades", {
      method: "POST",
      body: JSON.stringify({ grades }),
    }),

  getTopicGrades: () =>
    request<TopicGradeOut[]>("/api/students/me/topic-grades"),
};

// ─── Materials ───────────────────────────────────────────────────────────────

export const materialsApi = {
  list: (params?: {
    subject?: string;
    grade_level?: string;
    difficulty_level?: string;
    skip?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request<PagedMaterials>(`/api/materials${qs ? `?${qs}` : ""}`);
  },

  competencies: () => request<CompetencyOut[]>("/api/materials/competencies"),

  interact: (material_id: number, data: { time_spent_seconds?: number; quiz_score?: number }) =>
    request<{ success: boolean; new_mastery: number; competency: string }>(
      `/api/materials/${material_id}/interact`,
      { method: "POST", body: JSON.stringify({ material_id, ...data }) }
    ),

  preview: (url: string) =>
    request<MaterialPreviewResponse>("/api/materials/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  create: (data: MaterialCreate) =>
    request<MaterialOut>("/api/materials", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateQuiz: (material_id: number) =>
    request<AIQuizQuestion[]>(`/api/materials/${material_id}/quiz`),

  update: (material_id: number, data: MaterialUpdate) =>
    request<MaterialOut>(`/api/materials/${material_id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (material_id: number) =>
    request<void>(`/api/materials/${material_id}`, { method: "DELETE" }),
};

export interface WarningOut {
  warning_id: number;
  message: string;
  sent_at: string;
  is_read: boolean;
}

export interface AtRiskStudent {
  user_id: number;
  full_name: string;
  grade_level: string | null;
  overall_mastery: number;
  total_interactions: number;
  last_interaction: string | null;
  warning_already_sent: boolean;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  classOverview: () => request<ClassAnalyticsOut>("/api/analytics/class"),
  stats: () => request<SystemStats>("/api/analytics/stats"),
  atRisk: () => request<AtRiskStudent[]>("/api/analytics/at-risk"),
  warnStudent: (student_id: number, message?: string) =>
    request<{ sent: boolean; student: string }>(`/api/analytics/warn/${student_id}`, {
      method: "POST",
      body: JSON.stringify({ message: message ?? null }),
    }),
};

export const warningsApi = {
  getMyWarnings: () => request<WarningOut[]>("/api/students/me/warnings"),
  dismiss: (warning_id: number) =>
    request<void>(`/api/students/me/warnings/${warning_id}/read`, { method: "POST" }),
};
