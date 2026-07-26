import fetch from "node-fetch";
import crypto from "crypto";
import { query } from "../db/connection.js";
import { withRetry } from "../utils/retry.js";

const ARXIV_API = "http://export.arxiv.org/api/query";

export const crawlArxiv = async (category = "cs.AI", limit = 50) => {
  const jobId = crypto.randomUUID();

  await query(
    `INSERT INTO crawl_jobs (id, source_type, job_status, started_at)
     VALUES ($1, $2, $3, $4)`,
    [jobId, "arxiv", "running", new Date()],
  );

  try {
    const papers = await fetchArxivPapers(category, limit);

    let inserted = 0;
    for (const paper of papers) {
      const hash = crypto.createHash("sha256").update(paper.url).digest("hex");
      const result = await query(
        `INSERT INTO documents
         (source_type, source_url, title, abstract, authors, published_at, tags, hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (source_url) DO NOTHING`,
        [
          "arxiv",
          paper.url,
          paper.title,
          paper.summary,
          paper.authors.join("; "),
          new Date(paper.published),
          ["arxiv", category],
          hash,
          "active",
        ],
      );
      if (result.rowCount > 0) inserted++;
    }

    const skipped = papers.length - inserted;
    await query(
      `UPDATE crawl_jobs SET job_status = $1, finished_at = $2, documents_count = $3
       WHERE id = $4`,
      ["success", new Date(), inserted, jobId],
    );

    return { inserted, skipped, jobId };
  } catch (err) {
    await query(
      `UPDATE crawl_jobs SET job_status = $1, finished_at = $2, error_message = $3
       WHERE id = $4`,
      ["failed", new Date(), err.message, jobId],
    );
    throw err;
  }
};

async function fetchArxivPapers(category, limit) {
  const params = new URLSearchParams({
    search_query: `cat:${category}`,
    start: 0,
    max_results: limit,
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const res = await withRetry(() => fetch(`${ARXIV_API}?${params}`));
  const xml = await res.text();

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

    const authorMatches = [
      ...entry.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>/g),
    ];
    const arxivId = idMatch[1].split("/abs/")[1];

    papers.push({
      title: titleMatch[1].trim().replace(/\n/g, " "),
      summary: summaryMatch ? summaryMatch[1].trim().replace(/\n/g, " ") : "",
      url: `https://arxiv.org/abs/${arxivId}`,
      authors: authorMatches.map((m) => m[1].trim()),
      published: publishedMatch ? publishedMatch[1] : new Date(),
    });
  }

  return papers;
}
