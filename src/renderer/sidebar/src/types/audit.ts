export interface AuditIssue {
  severity: "critical" | "serious" | "moderate" | "minor";
  title: string;
  description: string;
  helpUrl?: string;
  elements: { html: string; selector: string }[];
  suggestedFix?: string;
}

export interface AuditCategory {
  name: string;
  score: number;
  issues: AuditIssue[];
}

export interface AuditReport {
  messageId: string;
  overallScore: number;
  categories: AuditCategory[];
  timestamp: number;
}

export interface ToolProgress {
  messageId: string;
  toolName: string;
  status: "running" | "complete" | "cancelled";
}

export interface HighlightRequest {
  selector: string;
  color: string;
  label: string;
  id?: string;
}

export interface ToolCallEvent {
  messageId: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent extends ToolCallEvent {
  output: unknown;
  durationMs: number;
  isError?: boolean;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "complete" | "error" | "cancelled";
  output?: unknown;
  durationMs?: number;
  startedAt: number;
}
