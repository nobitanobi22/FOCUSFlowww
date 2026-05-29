export interface User {
  id: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export type SessionState =
  | "active"
  | "focused"
  | "drifting"
  | "deeply_drifted"
  | "recovered"
  | "completed";

export interface IntentExpanded {
  core_concepts: string[];
  related_concepts: string[];
  excluded_concepts: string[];
  depth: "beginner" | "intermediate" | "advanced";
  estimated_duration_minutes?: number;
}

export interface SessionSummary {
  id: string;
  intent_raw: string;
  intent_expanded?: IntentExpanded;
  state: SessionState;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  final_drift_score?: number;
  completion_score?: number;
}

export interface SessionEvent {
  id: string;
  url: string;
  title?: string;
  content_type?: string;
  drift_score?: number;
  immediate_similarity?: number;
  estimated_read_time_seconds?: number;
  timestamp: string;
}

export interface SessionTransition {
  id: string;
  from_state: SessionState;
  to_state: SessionState;
  drift_score?: number;
  timestamp: string;
}

export interface SessionDetail extends SessionSummary {
  events: SessionEvent[];
  transitions: SessionTransition[];
}

export interface DriftPoint {
  timestamp: string;
  drift_score: number;
  state: string;
  url: string;
  content_type?: string;
}

export interface MetricsSummary {
  total_sessions: number;
  avg_focus_duration: number;
  avg_completion_score: number;
  total_events: number;
}

export interface PatternOut {
  avg_focus_duration_minutes?: number;
  best_focus_hour?: number;
  topic_completion_rate?: number;
  recovery_rate?: number;
  common_drift_topics?: string[];
  velocity_trend?: number;
  computed_at?: string;
}

export interface LiveUpdate {
  state: SessionState;
  drift_score: number;
  event_count: number;
}
