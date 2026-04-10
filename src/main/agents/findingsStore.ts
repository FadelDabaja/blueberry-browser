export interface Finding {
  id: string;
  category: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor' | 'info';
  description: string;
  selector?: string;
  suggestion?: string;
  sourceAgent: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

function severityOrder(sev: string): number {
  const order: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3, info: 4 };
  return order[sev] ?? 5;
}

export class FindingsStore {
  private findings: Finding[] = [];
  private idCounter = 0;

  add(finding: Omit<Finding, 'id' | 'timestamp'>): Finding {
    const entry: Finding = {
      ...finding,
      id: `f-${++this.idCounter}`,
      timestamp: Date.now(),
    };
    this.findings.push(entry);
    return entry;
  }

  addBatch(findings: Omit<Finding, 'id' | 'timestamp'>[]): Finding[] {
    return findings.map((f) => this.add(f));
  }

  getAll(): Finding[] {
    return [...this.findings];
  }

  getByCategory(category: string): Finding[] {
    return this.findings.filter((f) => f.category === category);
  }

  getBySeverity(severity: Finding['severity']): Finding[] {
    return this.findings.filter((f) => f.severity === severity);
  }

  getSummary(): string {
    if (this.findings.length === 0) return '';

    const bySev: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    for (const f of this.findings) {
      bySev[f.severity] = (bySev[f.severity] || 0) + 1;
      byCat[f.category] = (byCat[f.category] || 0) + 1;
    }

    const sevParts = Object.entries(bySev)
      .sort((a, b) => severityOrder(a[0]) - severityOrder(b[0]))
      .map(([s, n]) => `${n} ${s}`)
      .join(', ');
    const catParts = Object.entries(byCat)
      .map(([c, n]) => `${c}(${n})`)
      .join(', ');

    return `[Prior findings: ${this.findings.length} total — ${sevParts}. Categories: ${catParts}]`;
  }

  getStructured(): { category: string; count: number; findings: Finding[] }[] {
    const map = new Map<string, Finding[]>();
    for (const f of this.findings) {
      const list = map.get(f.category) || [];
      list.push(f);
      map.set(f.category, list);
    }
    return Array.from(map.entries()).map(([category, findings]) => ({
      category,
      count: findings.length,
      findings,
    }));
  }

  clear(): void {
    this.findings = [];
    this.idCounter = 0;
  }

  get count(): number {
    return this.findings.length;
  }
}
