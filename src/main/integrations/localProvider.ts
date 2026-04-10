import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import type { Task, TaskGroup, TaskProvider } from "./types";

export class LocalTaskProvider implements TaskProvider {
  private tasksPath: string;
  private groupsPath: string;
  private tasks: Task[] = [];
  private groups: TaskGroup[] = [];

  constructor() {
    const dir = join(app.getPath("userData"), "integrations");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.tasksPath = join(dir, "tasks.json");
    this.groupsPath = join(dir, "groups.json");
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.tasksPath)) {
        const raw: Task[] = JSON.parse(readFileSync(this.tasksPath, "utf-8"));
        // Backward compat: tasks without groupId get "ungrouped"
        this.tasks = raw.map((t) => ({ ...t, groupId: t.groupId || "ungrouped" }));
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
      this.tasks = [];
    }
    try {
      if (existsSync(this.groupsPath)) {
        this.groups = JSON.parse(readFileSync(this.groupsPath, "utf-8"));
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
      this.groups = [];
    }
  }

  private saveTasks(): void {
    try {
      writeFileSync(this.tasksPath, JSON.stringify(this.tasks, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save tasks:", error);
    }
  }

  private saveGroups(): void {
    try {
      writeFileSync(this.groupsPath, JSON.stringify(this.groups, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save groups:", error);
    }
  }

  // --- Groups ---

  async createGroup(name: string): Promise<TaskGroup> {
    const group: TaskGroup = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    this.groups.push(group);
    this.saveGroups();
    return group;
  }

  async listGroups(): Promise<TaskGroup[]> {
    return [...this.groups];
  }

  async deleteGroup(id: string): Promise<boolean> {
    const idx = this.groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    this.groups.splice(idx, 1);
    // Cascade: remove all tasks in this group
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.groupId !== id);
    this.saveGroups();
    if (this.tasks.length !== before) this.saveTasks();
    return true;
  }

  // --- Tasks ---

  async createTask(task: Omit<Task, "id" | "createdAt" | "status">): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: randomUUID(),
      status: "open",
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(newTask);
    this.saveTasks();
    return newTask;
  }

  async createTasks(tasks: Omit<Task, "id" | "createdAt" | "status">[]): Promise<Task[]> {
    const now = new Date().toISOString();
    const created: Task[] = tasks.map((t) => ({
      ...t,
      id: randomUUID(),
      status: "open" as const,
      createdAt: now,
    }));
    this.tasks.push(...created);
    this.saveTasks();
    return created;
  }

  async listTasks(filter?: { status?: "open" | "closed" | "all"; groupId?: string }): Promise<Task[]> {
    let result = [...this.tasks];
    const status = filter?.status || "all";
    if (status !== "all") {
      result = result.filter((t) => t.status === status);
    }
    if (filter?.groupId) {
      result = result.filter((t) => t.groupId === filter.groupId);
    }
    return result;
  }

  async updateTask(id: string, updates: Partial<Pick<Task, "status" | "title" | "description">>): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, updates);
    this.saveTasks();
    return { ...task };
  }

  async deleteTask(id: string): Promise<boolean> {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    this.saveTasks();
    return true;
  }
}
