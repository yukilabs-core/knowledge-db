import dotenv from "dotenv";
import { crawlArxiv } from "../src/crawlers/arxiv.js";
import { crawlDevTo } from "../src/crawlers/devto.js";
import discordService from "../src/services/discordService.js";

dotenv.config();

async function runCrawlers() {
  console.log("🕷️ Starting crawlers...\n");

  try {
    // arXiv: AI category
    console.log("📄 Phase 1: arXiv");
    const arxivStart = Date.now();
    const arxivResult = await crawlArxiv("cs.AI", 100);
    const arxivDuration = Date.now() - arxivStart;
    console.log(`✓ arXiv done: ${arxivResult.inserted} inserted\n`);

    // Send Discord notification
    await discordService.sendCrawlerCompletion({
      crawler: "arXiv (cs.AI)",
      count: arxivResult.inserted,
      duration: arxivDuration,
      status: "success",
    });

    // Dev.to: AI tag
    console.log("📝 Phase 2: Dev.to");
    const devtoStart = Date.now();
    const devtoResult = await crawlDevTo("ai", 100);
    const devtoDuration = Date.now() - devtoStart;
    console.log(`✓ Dev.to done: ${devtoResult.inserted} inserted\n`);

    // Send Discord notification
    await discordService.sendCrawlerCompletion({
      crawler: "Dev.to (ai)",
      count: devtoResult.inserted,
      duration: devtoDuration,
      status: "success",
    });

    console.log("✅ All crawlers completed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Crawler error:", err);

    // Send Discord error notification
    await discordService.sendError({
      title: "Knowledge DB Crawler Failed",
      message: err.message,
      source: "run-crawler.js",
      stack: err.stack,
      severity: "high",
    });

    process.exit(1);
  }
}

runCrawlers();
