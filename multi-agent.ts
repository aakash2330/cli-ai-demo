#!/usr/bin/env bun

const AgentStatus = {
  PENDING_INIT: "pending_init",
  RUNNING: "running",
  COMPLETED: "completed",
} as const;

type AgentStatusValue = (typeof AgentStatus)[keyof typeof AgentStatus];
type Role = "designer" | "coder";
type AgentPlan = { role: Role; task: string };
type AgentMessage = { from: string; text: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Agent {
  public status: AgentStatusValue = AgentStatus.PENDING_INIT;
  public messages: AgentMessage[] = [];
  public result: unknown = null;

  constructor(
    public id: string,
    public role: Role,
    public task: string,
  ) {}

  async start() {
    console.log(`[${this.role}:${this.id}] start -> ${this.task}`);
    this.status = AgentStatus.RUNNING;
    await this.processTask();
  }

  async processTask() {
    await sleep(500);
    this.complete({ task: this.task });
  }

  receiveMessage(message: AgentMessage) {
    this.messages.push(message);
    console.log(`[${this.role}:${this.id}] queued message: "${message.text}"`);
  }

  protected processQueuedMessages() {
    const updates = this.messages.map((m) => `[from ${m.from}] ${m.text}`);
    console.log(`[${this.role}:${this.id}] processing queued messages:`, updates);
    return updates;
  }

  protected complete(result: unknown) {
    this.result = result;
    this.status = AgentStatus.COMPLETED;
    console.log(`[${this.role}:${this.id}] completed`);
  }
}

class DesignerAgent extends Agent {
  override async processTask() {
    console.log("[designer] creating a mock design update...");
    await sleep(1200);
    const appliedUpdates = this.processQueuedMessages();
    this.complete({
      updateText: "Use cleaner section structure",
      appliedUpdates,
    });
  }
}

class CoderAgent extends Agent {
  override async processTask() {
    console.log("[coder] coding is in progress...");
    await sleep(2000);
    const appliedUpdates = this.processQueuedMessages();

    this.complete({
      output: "mock-code-output",
      appliedUpdates,
    });
  }
}

class Orchestrator {
  private agents = new Map<string, Agent>();
  private runs = new Map<string, Promise<void>>();

  private async planWithLlm(prompt: string): Promise<AgentPlan[]> {
    console.log("[orchestrator] mock LLM decides which agents to spawn...");
    await sleep(300);
    return [
      { role: "designer", task: `Design for: ${prompt}` },
      { role: "coder", task: `Code for: ${prompt}` },
    ];
  }

  private spawnAgent(role: Role, task: string) {
    const id = `${role}-${Math.random().toString(36).slice(2, 6)}`;
    const agent = role === "designer"
      ? new DesignerAgent(id, role, task)
      : new CoderAgent(id, role, task);
    this.agents.set(id, agent);
    this.runs.set(id, agent.start());
    return id;
  }

  private sendInput(toAgentId: string, message: AgentMessage) {
    this.agents.get(toAgentId)?.receiveMessage(message);
  }

  private async waitFor(agentIds: string[]) {
    await Promise.all(agentIds.map((id) => this.runs.get(id)));
  }

  async run(prompt: string) {
    const plan = await this.planWithLlm(prompt);
    const ids = new Map<Role, string>();

    for (const item of plan) {
      ids.set(item.role, this.spawnAgent(item.role, item.task));
    }

    const designerId = ids.get("designer")!;
    const coderId = ids.get("coder")!;

    setTimeout(() => {
      this.sendInput(coderId, {
        from: designerId,
        text: "Update from designer: simplify the structure",
      });
    }, 800);
    setTimeout(() => {
      this.sendInput(designerId, {
        from: coderId,
        text: "Update from coder: keep components reusable",
      });
    }, 500);

    await this.waitFor([designerId, coderId]);

    return {
      design: this.agents.get(designerId)?.result,
      code: this.agents.get(coderId)?.result,
    };
  }
}

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim() || "Landing page";
  const orchestrator = new Orchestrator();
  const result = await orchestrator.run(prompt);
  console.log("Final result:", result);
}

void main();
