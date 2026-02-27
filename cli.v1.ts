#!/usr/bin/env bun

console.log("Hello from CLI agent\n");

process.stdout.write("> ");

process.stdin.setEncoding("utf8");

process.stdin.on("data", (input) => {
  const trimmed = input.trim();

  if (trimmed === "exit") {
    console.log("Goodbye 👋");
    process.exit(0);
  }

  console.log(`You typed: ${trimmed}\n`);
  process.stdout.write("> ");
});
