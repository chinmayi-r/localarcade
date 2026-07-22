import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const root = path.resolve(import.meta.dirname, "..");
const ignored = new Set([".git", ".next", "node_modules", "target", "dist"]);
const failures = [];
const markdown = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.toLowerCase().endsWith(".md")) markdown.push(file);
  }
}

walk(root);
const decoder = new TextDecoder("utf-8", { fatal: true });
for (const file of markdown.sort()) {
  let text;
  try {
    text = decoder.decode(fs.readFileSync(file));
  } catch (error) {
    failures.push(`${path.relative(root, file)}: invalid UTF-8 (${error.message})`);
    continue;
  }
  if (/[ÂÃâ][^\s]?/.test(text)) failures.push(`${path.relative(root, file)}: possible mojibake`);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^(?:[a-z]+:|#)/i.test(target)) continue;
    target = decodeURIComponent(target);
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
      failures.push(`${path.relative(root, file)}: missing relative link ${match[1]}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated UTF-8, mojibake, and relative links in ${markdown.length} Markdown files.`);
}
