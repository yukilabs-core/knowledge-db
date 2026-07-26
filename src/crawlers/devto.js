import fetch from "node-fetch";
import crypto from "crypto";
import { query } from "../db/connection.js";

const DEVTO_API = "https://dev.to/api/articles";

export const crawlDevTo = async (tag = "ai", limit = 50) => {
  const jobId = crypto.randomUUID();

  await query(
    `INSERT INTO crawl_jobs (id, source_type, job_status, started_at)
     VALUES ($1, $2, $3, $4)`,
    [jobId, "devto", "running", new Date()],
  );

  try {
    const articles = await fetchDevToArticles(tag, limit);

    let inserted = 0;
    for (const article of articles) {
      const hash = crypto
        .createHash("sha256")
        .update(article.url)
        .digest("hex");
      const result = await query(
        `INSERT INTO documents
         (source_type, source_url, title, abstract, authors, published_at, tags, hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (source_url) DO NOTHING`,
        [
          "devto",
          article.url,
          article.title,
          article.description,
          article.author,
          new Date(article.publishedAt),
          ["devto", tag, ...article.tags],
          hash,
          "active",
        ],
      );
      if (result.rowCount > 0) inserted++;
    }

    const skipped = articles.length - inserted;
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

async function fetchDevToArticles(tag, limit) {
  const params = new URLSearchParams({
    tag,
    top: "infinity",
    per_page: Math.min(limit, 1000),
  });

  const res = await fetch(`${DEVTO_API}?${params}`);
  const articles = await res.json();

  return articles.map((article) => ({
    title: article.title,
    description:
      article.description || (article.body_markdown || "").substring(0, 500),
    url: article.url,
    author: article.user.name,
    publishedAt: article.published_at,
    tags: article.tag_list || [],
  }));
}
