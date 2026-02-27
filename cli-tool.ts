#!/usr/bin/env bun

import { OpenRouter } from "@openrouter/sdk";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

console.log("Hello from CLI agent\n");

process.stdout.write("> ");

process.stdin.setEncoding("utf8");

process.stdin.on("data", async (input: string) => {
  const trimmed = input.trim();

  if (trimmed === "exit") {
    console.log("Goodbye 👋");
    process.exit(0);
  }

  const response = await client.chat.send({
    chatGenerationParams: {
      model: "gpt-4o",
      messages: [{ role: "user", content: trimmed }],
    },
  });

console.log(response.choices?.[0]?.message?.content);

  // for await (const chunk of stream) {
  //   const content = chunk.choices?.[0]?.delta?.content;
  //   if (content) {
  //     console.log(content);
  //   }
  //   // Final chunk includes usage stats
  //   if (chunk.usage) {
  //     console.log("Usage:", chunk.usage);
  //   }
  // }

  process.stdout.write("> ");
});
