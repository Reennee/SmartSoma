/**
 * SmartSoma API Client
 * Typed fetch wrapper pointing at the FastAPI backend.
 * All methods that require auth read the JWT from localStorage automatically.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: "student" | "teacher";
  user_id: number;
  full_name: string;
}

export interface UserOut {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  grade_level: string | null;
  created_at: string;
}

export interface RecommendedMaterial {
  material_id: number;
  title: string;
  subject: string;
  competency_name: string;
  grade_level: string;
  difficulty_level: string;
  content_type: string | null;
  duration_minutes: number | null;
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
  subject: string;
  competency_id: number;
  competency_name: string;
  difficulty_level: string;
  content_type: string | null;
  duration_minutes: number | null;
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

// ─── Client ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("smartsoma_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    grade_level?: string;
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
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsApi = {
  classOverview: () => request<ClassAnalyticsOut>("/api/analytics/class"),
  stats: () => request<SystemStats>("/api/analytics/stats"),
};
