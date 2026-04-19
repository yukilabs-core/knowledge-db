import fetch from 'node-fetch';
import crypto from 'crypto';
import { query } from '../db/connection.js';

// arXiv API: https://arxiv.org/help/api/basics
const ARXIV_API = 'http://export.arxiv.org/api/query';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const crawlArxiv = async (category = 'cs.AI', limit = 50) => {
  console.log(`[arXiv] Starting crawl for category: ${category}`);

  const jobId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    await query(
      `INSERT INTO crawl_jobs (id, source_type, job_status, started_at)
       VALUES ($1, $2, $3, $4)`,
      [jobId, 'arxiv', 'running', startedAt]
    );

    const papers = await fetchArxivPapers(category, limit);
    console.log(`[arXiv] Fetched ${papers.length} papers`);

    let inserted = 0;
    let skipped = 0;

    for (const paper of papers) {
      try {
        const hash = generateHash(paper.url);

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
            'arxiv',
            paper.url,
            paper.title,
            paper.summary,
            paper.authors.join('; '),
            new Date(paper.published),
            ['arxiv', category],
            hash,
            'active'
          ]
        );
        inserted++;
      } catch (err) {
        console.error(`[arXiv] Error inserting paper: ${err.message}`);
      }
    }

    await query(
      `UPDATE crawl_jobs SET job_status = $1, finished_at = $2, documents_count = $3
       WHERE id = $4`,
      ['success', new Date(), inserted, jobId]
    );

    console.log(`[arXiv] ✓ Inserted: ${inserted}, Skipped: ${skipped}`);
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

async function fetchArxivPapers(category, limit) {
  const searchQuery = `cat:${category}`;
  const params = new URLSearchParams({
    search_query: searchQuery,
    start: 0,
    max_results: limit,
    sortBy: 'submittedDate',
    sortOrder: 'descending'
  });

  const url = `${ARXIV_API}?${params}`;
  console.log(`[arXiv] Fetching: ${url}`);

  const res = await fetch(url);
  const xml = await res.text();

  // Simple XML parsing for arXiv entries
  const papers = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(entry);
    const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(entry);
    const idMatch = /<id>(.*?)<\/id>/.exec(entry);
    const publishedMatch = /<published>([\s\S]*?)<\/published>/.exec(entry);

    if (!titleMatch || !idMatch) continue;

    const authorMatches = [...entry.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>/g)];
    const authors = authorMatches.map(m => m[1].trim());

    const arxivId = idMatch[1].split('/abs/')[1];

    papers.push({
      title: titleMatch[1].trim().replace(/\n/g, ' '),
      summary: summaryMatch ? summaryMatch[1].trim().replace(/\n/g, ' ') : '',
      url: `https://arxiv.org/abs/${arxivId}`,
      arxivId,
      authors,
      published: publishedMatch ? publishedMatch[1] : new Date()
    });
  }

  return papers;
}

function generateHash(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}
