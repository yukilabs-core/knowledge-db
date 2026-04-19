import { query } from '../db/connection.js';

export const searchDocuments = async (searchQuery, limit = 10, offset = 0) => {
  const startTime = Date.now();

  try {
    // Normalize query
    const normalizedQuery = normalizeQuery(searchQuery);

    // Full Text Search using PostgreSQL
    const result = await query(
      `SELECT
        id, source_type, source_url, title, abstract, authors, published_at, tags,
        ts_rank(to_tsvector('english', title || ' ' || COALESCE(abstract, '')),
                plainto_tsquery('english', $1)) as relevance_score
       FROM documents
       WHERE status = 'active'
         AND to_tsvector('english', title || ' ' || COALESCE(abstract, ''))
             @@ plainto_tsquery('english', $1)
       ORDER BY relevance_score DESC, published_at DESC
       LIMIT $2 OFFSET $3`,
      [normalizedQuery, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM documents
       WHERE status = 'active'
         AND to_tsvector('english', title || ' ' || COALESCE(abstract, ''))
             @@ plainto_tsquery('english', $1)`,
      [normalizedQuery]
    );

    const responseMsMs = Date.now() - startTime;

    // Log search
    await logSearch(searchQuery, result.rows.length, responseMsMs);

    return {
      query: searchQuery,
      results: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        abstract: row.abstract,
        source_url: row.source_url,
        source_type: row.source_type,
        published_at: row.published_at,
        authors: row.authors,
        tags: row.tags,
        relevance_score: Math.round(row.relevance_score * 1000) / 1000
      })),
      total_count: parseInt(countResult.rows[0].total),
      response_ms: responseMsMs
    };
  } catch (err) {
    console.error('[Search] Error:', err);
    throw err;
  }
};

export const getDocuments = async (limit = 20, offset = 0) => {
  try {
    const result = await query(
      `SELECT id, source_type, source_url, title, abstract, authors, published_at, tags
       FROM documents
       WHERE status = 'active'
       ORDER BY published_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM documents WHERE status = $1',
      ['active']
    );

    return {
      total: parseInt(countResult.rows[0].total),
      documents: result.rows,
      limit,
      offset
    };
  } catch (err) {
    console.error('[Documents] Error:', err);
    throw err;
  }
};

export const getStats = async () => {
  try {
    const statsResult = await query(
      `SELECT
        COUNT(*) as total_documents,
        COUNT(DISTINCT source_type) as source_types,
        COUNT(DISTINCT DATE(published_at)) as days_covered
       FROM documents
       WHERE status = 'active'`
    );

    const bySourceResult = await query(
      `SELECT source_type, COUNT(*) as count
       FROM documents
       WHERE status = 'active'
       GROUP BY source_type
       ORDER BY count DESC`
    );

    return {
      total_documents: parseInt(statsResult.rows[0].total_documents),
      source_types: parseInt(statsResult.rows[0].source_types),
      days_covered: parseInt(statsResult.rows[0].days_covered),
      by_source: bySourceResult.rows
    };
  } catch (err) {
    console.error('[Stats] Error:', err);
    throw err;
  }
};

async function logSearch(query, resultCount, responseMsMs) {
  try {
    await query(
      `INSERT INTO search_logs (query, result_count, response_ms)
       VALUES ($1, $2, $3)`,
      [query, resultCount, responseMsMs]
    );
  } catch (err) {
    console.error('[SearchLog] Error:', err);
    // Don't throw - logging failure shouldn't break search
  }
}

function normalizeQuery(searchQuery) {
  return searchQuery
    .toLowerCase()
    .trim()
    .replace(/[^\w\s&|]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .join(' & ');
}
