import fetch from 'node-fetch';
import crypto from 'crypto';
import { query } from '../db/connection.js';

// Dev.to API: https://developers.forem.com/api
const DEVTO_API = 'https://dev.to/api/articles';

export const crawlDevTo = async (tag = 'ai', limit = 50) => {
  console.log(`[Dev.to] Starting crawl for tag: ${tag}`);

  const jobId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    await query(
      `INSERT INTO crawl_jobs (id, source_type, job_status, started_at)
       VALUES ($1, $2, $3, $4)`,
      [jobId, 'devto', 'running', startedAt]
    );

    const articles = await fetchDevToArticles(tag, limit);
    console.log(`[Dev.to] Fetched ${articles.length} articles`);

    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        const hash = generateHash(article.url);

        // Check if already exists
        const existing = await query(
          'SELECT id FROM documents WHERE hash = $1',
          [hash]
        );

        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        await query(
          `INSERT INTO documents
           (source_type, source_url, title, abstract, authors, published_at, tags, hash, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            'devto',
            article.url,
            article.title,
            article.description,
            article.author,
            new Date(article.publishedAt),
            ['devto', tag, ...article.tags],
            hash,
            'active'
          ]
        );
        inserted++;
      } catch (err) {
        console.error(`[Dev.to] Error inserting article: ${err.message}`);
      }
    }

    await query(
      `UPDATE crawl_jobs SET job_status = $1, finished_at = $2, documents_count = $3
       WHERE id = $4`,
      ['success', new Date(), inserted, jobId]
    );

    console.log(`[Dev.to] ✓ Inserted: ${inserted}, Skipped: ${skipped}`);
    return { inserted, skipped, jobId };
  } catch (err) {
    await query(
      `UPDATE crawl_jobs SET job_status = $1, finished_at = $2, error_message = $3
       WHERE id = $4`,
      ['failed', new Date(), err.message, jobId]
    );
    throw err;
  }
};

async function fetchDevToArticles(tag, limit) {
  const params = new URLSearchParams({
    tag,
    top: 'infinity',
    per_page: Math.min(limit, 1000)
  });

  const url = `${DEVTO_API}?${params}`;
  console.log(`[Dev.to] Fetching: ${url}`);

  const res = await fetch(url);
  const articles = await res.json();

  return articles.map(article => ({
    title: article.title,
    description: article.description || article.body_markdown.substring(0, 500),
    url: article.url,
    author: article.user.name,
    publishedAt: article.published_at,
    tags: article.tag_list || []
  }));
}

function generateHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}
