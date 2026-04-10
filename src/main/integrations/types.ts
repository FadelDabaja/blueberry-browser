export interface TaskGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface Task {
  id: string;
  groupId: string;
  title: string;
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor" | "info";
  source: string;
  status: "open" | "closed";
  createdAt: string;
  url?: string;
  category?: string;
  selector?: string;
  fix?: string;
  codeSnippet?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskProvider {
  // Groups
  createGroup(name: string): Promise<TaskGroup>;
  listGroups(): Promise<TaskGroup[]>;
  deleteGroup(id: string): Promise<boolean>;

  // Tasks
  createTask(task: Omit<Task, "id" | "createdAt" | "status">): Promise<Task>;
  createTasks(tasks: Omit<Task, "id" | "createdAt" | "status">[]): Promise<Task[]>;
  listTasks(filter?: { status?: "open" | "closed" | "all"; groupId?: string }): Promise<Task[]>;
  updateTask(id: string, updates: Partial<Pick<Task, "status" | "title" | "description">>): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;
}
