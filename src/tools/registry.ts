import type { ToolContext, ToolDefinition, ToolObservation } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async call(name: string, input: unknown, context: ToolContext): Promise<ToolObservation> {
    const tool = this.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}`, metadata: { tool: name, timestamp: new Date().toISOString() } };
    return tool.execute(input as never, context);
  }
}
