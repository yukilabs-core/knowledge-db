import dotenv from 'dotenv';
import { crawlArxiv } from '../src/crawlers/arxiv.js';
import { crawlDevTo } from '../src/crawlers/devto.js';

dotenv.config();

async function runCrawlers() {
  console.log('🕷️ Starting crawlers...\n');

  try {
    // arXiv: AI category
    console.log('📄 Phase 1: arXiv');
    const arxivResult = await crawlArxiv('cs.AI', 100);
    console.log(`✓ arXiv done: ${arxivResult.inserted} inserted\n`);

    // Dev.to: AI tag
    console.log('📝 Phase 2: Dev.to');
    const devtoResult = await crawlDevTo('ai', 100);
    console.log(`✓ Dev.to done: ${devtoResult.inserted} inserted\n`);

    console.log('✅ All crawlers completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Crawler error:', err);
    process.exit(1);
  }
}

runCrawlers();
