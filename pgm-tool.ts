#!/usr/bin/env bun

import { OpenRouter } from "@openrouter/sdk";
import { appendFile } from "node:fs/promises";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});
const TOOL_SCRIPT_LOG_PATH = new URL("./tool-script.log", import.meta.url).pathname;

type ToolResult = Record<string, unknown>;

type ToolFn = (...args: unknown[]) => ToolResult;

const tools: Record<string, ToolFn> = {
  add(a: unknown, b: unknown) {
    return {
      result: Number(a) + Number(b),
    };
  },

  toUpper(text: unknown) {
    return {
      result: String(text ?? "").toUpperCase(),
    };
  },
};

const SYSTEM_PROMPT = `
You are a helpful assistant with optional programmatic tools.
You can either:
1) Reply normally in plain text, OR
2) Return a tool script when tools are useful.

Available tools:
- tools.add(a, b) -> { result: number }
- tools.toUpper(text) -> { result: string }
- input (user text)

If you choose a script, respond with ONLY:
<tool_script>
// JavaScript to execute with (tools, input)
// must end with: return <json-serializable-value>;
</tool_script>

If you choose a normal answer, do NOT include <tool_script>.
`.trim();

function extractToolScript(raw: string): string | null {
  const match = raw.match(/<tool_script>\s*([\s\S]*?)\s*<\/tool_script>/i);
  return match?.[1]?.trim() ?? null;
}

async function runModelScript(code: string, input: string) {
  const AsyncFunction: (
    ...args: string[]
  ) => (...innerArgs: unknown[]) => Promise<unknown> = Object.getPrototypeOf(
    async function () {},
  ).constructor;

  const runner = AsyncFunction(
    "tools",
    "input",
    `
    "use strict";
    ${code}
  `,
  );

  return Promise.race([
    runner(tools, input),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Script timed out after 10s")), 10_000),
    ),
  ]);
}

async function logToolRun(params: {
  input: string;
  script: string;
  result?: unknown;
  error?: unknown;
}) {
  const { input, script, result, error } = params;
  const lines = [
    "",
    `[${new Date().toISOString()}]`,
    `input: ${input}`,
    "script:",
    script,
  ];

  if (error) {
    lines.push("error:");
    lines.push(error instanceof Error ? error.stack ?? error.message : String(error));
  } else {
    lines.push("result:");
    lines.push(JSON.stringify(result, null, 2));
  }

  lines.push("---");
  await appendFile(TOOL_SCRIPT_LOG_PATH, `${lines.join("\n")}\n`, "utf8");
}

console.log("Programmatic tool-calling (type 'exit' to quit)\n");

process.stdout.write("> ");

process.stdin.setEncoding("utf8");

process.stdin.on("data", async (input: string) => {
  const trimmed = input.trim();

  if (trimmed === "exit") {
    console.log("Goodbye 👋");
    process.exit(0);
  }

  try {
    const response = await client.chat.send({
      chatGenerationParams: {
        model: "gpt-4o",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      },
    });

    const raw = (response.choices?.[0]?.message?.content ?? "").trim();
    const code = extractToolScript(raw);

    if (!code) {
      console.log(raw);
    } else {
      console.log("\n--- generated script ---");
      console.log(code);

      try {
        const result = await runModelScript(code, trimmed);
        console.log("--- script result ---");
        console.log(JSON.stringify(result, null, 2));
        await logToolRun({ input: trimmed, script: code, result });
      } catch (scriptError) {
        await logToolRun({ input: trimmed, script: code, error: scriptError });
        throw scriptError;
      }
    }
  } catch (error) {
    console.error("Execution failed:", error);
  }

  process.stdout.write("> ");
});
