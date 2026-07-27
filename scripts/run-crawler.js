import dotenv from "dotenv";
import { crawlArxiv } from "../src/crawlers/arxiv.js";
import { crawlDevTo } from "../src/crawlers/devto.js";

dotenv.config();

const category = process.env.ARXIV_CATEGORY || "cs.AI";
const tag = process.env.DEVTO_TAG || "ai";
const limit = parseInt(process.env.CRAWL_LIMIT || "100", 10);

async function runCrawlers() {
  const results = {};

  try {
    results.arxiv = await crawlArxiv(category, limit);
  } catch {
    process.exitCode = 1;
  }

  try {
    results.devto = await crawlDevTo(tag, limit);
  } catch {
    process.exitCode = 1;
  }

  const total = (results.arxiv?.inserted ?? 0) + (results.devto?.inserted ?? 0);
  process.stdout.write(
    `crawl complete: arxiv=${results.arxiv?.inserted ?? "err"} devto=${results.devto?.inserted ?? "err"} total=${total}\n`,
  );
}

runCrawlers();
