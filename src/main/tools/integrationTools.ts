import { tool } from "ai";
import { z } from "zod";
import { LocalTaskProvider } from "../integrations/localProvider";
import type { FindingsStore } from "../agents/findingsStore";

let provider: LocalTaskProvider | null = null;

export function getProvider(): LocalTaskProvider {
  if (!provider) provider = new LocalTaskProvider();
  return provider;
}

function generateCodeSnippet(finding: { category: string; selector?: string; suggestion?: string; description: string }): string | undefined {
  if (!finding.selector) return undefined;

  const sel = finding.selector;
  switch (finding.category) {
    case 'contrast':
      return `/* Fix contrast for ${sel} */\n${sel} {\n  color: /* darker color */;\n  /* or */ background-color: /* lighter color */;\n}`;
    case 'alt-text':
      return `<!-- Add alt text -->\n<img src="..." alt="Descriptive text here">`;
    case 'click-targets':
      return `/* Increase tap target size */\n${sel} {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 8px;\n}`;
    case 'empty-elements':
      return `<!-- Remove empty element or add content -->\n<!-- ${sel} is empty and takes up ${finding.description} -->`;
    default:
      return finding.suggestion ? `/* ${finding.suggestion} */` : undefined;
  }
}

export function createIntegrationTools(findingsStore?: FindingsStore) {
  return {
    create_group: tool({
      description:
        "Create a new task group to organize related tasks (e.g. audit findings for a page). Returns the group with its UUID.",
      inputSchema: z.object({
        name: z.string().describe("Group name, e.g. 'Audit of example.com - 2026-04-07'"),
      }),
      execute: async ({ name }) => {
        const group = await getProvider().createGroup(name);
        return { group, message: `Group created: ${group.name} (${group.id})` };
      },
    }),

    create_tasks_batch: tool({
      description:
        "Create multiple tasks in a single batch within a task group. More efficient than creating tasks one by one.",
      inputSchema: z.object({
        groupId: z.string().describe("UUID of the group to add tasks to"),
        tasks: z.array(
          z.object({
            title: z.string().describe("Task title"),
            description: z.string().describe("Detailed description of the task"),
            severity: z
              .enum(["critical", "serious", "moderate", "minor", "info"])
              .nullable()
              .describe("Severity level, or null if not applicable"),
            url: z.string().nullable().describe("Related URL, if any"),
            category: z.string().nullable().describe("Issue category (e.g. contrast, alt-text, performance)"),
            selector: z.string().nullable().describe("CSS selector of the affected element"),
            fix: z.string().nullable().describe("Suggested fix for the issue"),
            codeSnippet: z.string().nullable().describe("Code example showing how to fix"),
          })
        ).describe("Array of tasks to create"),
      }),
      execute: async ({ groupId, tasks: taskInputs }) => {
        const p = getProvider();
        // Look up group name for source field
        const groups = await p.listGroups();
        const group = groups.find((g) => g.id === groupId);
        const source = group?.name || groupId;

        const created = await p.createTasks(
          taskInputs.map((t) => ({
            title: t.title,
            description: t.description,
            severity: t.severity || "info",
            source,
            groupId,
            url: t.url || undefined,
            category: t.category || undefined,
            selector: t.selector || undefined,
            fix: t.fix || undefined,
            codeSnippet: t.codeSnippet || undefined,
          }))
        );
        return {
          tasks: created,
          count: created.length,
          groupId,
          groupName: source,
          message: `Created ${created.length} tasks in group "${source}"`,
        };
      },
    }),

    list_groups: tool({
      description: "List all task groups with the count of open tasks in each group.",
      inputSchema: z.object({}),
      execute: async () => {
        const p = getProvider();
        const groups = await p.listGroups();
        const allTasks = await p.listTasks();

        const result = groups.map((g) => {
          const groupTasks = allTasks.filter((t) => t.groupId === g.id);
          const openCount = groupTasks.filter((t) => t.status === "open").length;
          return { ...g, taskCount: groupTasks.length, openCount };
        });

        // Check for ungrouped tasks
        const ungrouped = allTasks.filter((t) => t.groupId === "ungrouped");
        if (ungrouped.length > 0) {
          result.push({
            id: "ungrouped",
            name: "Ungrouped",
            createdAt: "",
            taskCount: ungrouped.length,
            openCount: ungrouped.filter((t) => t.status === "open").length,
          });
        }

        return { groups: result, count: result.length };
      },
    }),

    delete_group: tool({
      description: "Delete a task group and all its tasks. This action cannot be undone.",
      inputSchema: z.object({
        id: z.string().describe("UUID of the group to delete"),
      }),
      execute: async ({ id }) => {
        const deleted = await getProvider().deleteGroup(id);
        if (!deleted) return { error: `Group ${id} not found` };
        return { message: `Group ${id} and all its tasks deleted` };
      },
    }),

    list_tasks: tool({
      description: "List all saved tasks, optionally filtered by status and/or group.",
      inputSchema: z.object({
        status: z
          .enum(["open", "closed", "all"])
          .nullable()
          .describe("Filter by status. Null defaults to 'all'."),
        groupId: z
          .string()
          .nullable()
          .describe("Filter by group UUID. Null returns all groups."),
      }),
      execute: async ({ status, groupId }) => {
        const tasks = await getProvider().listTasks({
          status: status || "all",
          groupId: groupId || undefined,
        });
        return { tasks, count: tasks.length };
      },
    }),

    update_task: tool({
      description: "Update an existing task's status, title, or description.",
      inputSchema: z.object({
        id: z.string().describe("Task ID to update"),
        status: z.enum(["open", "closed"]).nullable().describe("New status, or null to keep current"),
        title: z.string().nullable().describe("New title, or null to keep current"),
        description: z.string().nullable().describe("New description, or null to keep current"),
      }),
      execute: async ({ id, status, title, description }) => {
        const updates: Record<string, string> = {};
        if (status) updates.status = status;
        if (title) updates.title = title;
        if (description) updates.description = description;

        const task = await getProvider().updateTask(id, updates);
        if (!task) return { error: `Task ${id} not found` };
        return { task, message: `Task updated: ${task.title}` };
      },
    }),

    delete_task: tool({
      description: "Delete a single task by ID.",
      inputSchema: z.object({
        id: z.string().describe("Task ID to delete"),
      }),
      execute: async ({ id }) => {
        const deleted = await getProvider().deleteTask(id);
        if (!deleted) return { error: `Task ${id} not found` };
        return { message: `Task ${id} deleted` };
      },
    }),

    ...(findingsStore ? {
      create_tasks_from_findings: tool({
        description:
          "Create tasks from accumulated agent findings. Automatically creates a group and batch-creates tasks with fix suggestions and code snippets from the FindingsStore.",
        inputSchema: z.object({
          groupName: z.string().describe("Name for the task group"),
          minSeverity: z.enum(["critical", "serious", "moderate", "minor", "info"]).nullable().describe("Minimum severity to include (default: all)"),
          url: z.string().nullable().describe("URL these findings relate to"),
        }),
        execute: async ({ groupName, minSeverity, url }) => {
          const findings = findingsStore.getAll();
          if (findings.length === 0) {
            return { error: "No findings in store. Run audit tools first." };
          }

          const severityOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3, info: 4 };
          const minLevel = severityOrder[minSeverity || "info"] ?? 4;
          const filtered = findings.filter(f => (severityOrder[f.severity] ?? 4) <= minLevel);

          if (filtered.length === 0) {
            return { error: `No findings at severity ${minSeverity} or higher.` };
          }

          const p = getProvider();
          const group = await p.createGroup(groupName);
          const tasks = await p.createTasks(
            filtered.map(f => ({
              title: f.description.slice(0, 120),
              description: f.description,
              severity: f.severity,
              source: `${f.sourceAgent}/${f.toolName || 'unknown'}`,
              groupId: group.id,
              url: url || undefined,
              category: f.category,
              selector: f.selector,
              fix: f.suggestion,
              codeSnippet: generateCodeSnippet(f),
            }))
          );

          return {
            group,
            tasks,
            count: tasks.length,
            message: `Created ${tasks.length} tasks from ${findings.length} findings in group "${groupName}"`,
          };
        },
      }),
    } : {}),
  };
}
