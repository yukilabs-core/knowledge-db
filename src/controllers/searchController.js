import {
  searchDocuments,
  getDocuments,
  getStats,
} from "../services/searchService.js";

export const search = async (req, res) => {
  try {
    const { query, limit = 10, offset = 0 } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "query parameter is required" });
    }
    if (query.length > 500) {
      return res
        .status(400)
        .json({ success: false, error: "query too long (max 500 chars)" });
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 50);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    const results = await searchDocuments(query, safeLimit, safeOffset);

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("[SearchController] Error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const listDocuments = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);
    const documents = await getDocuments(safeLimit, safeOffset);

    res.json({
      success: true,
      data: documents,
    });
  } catch (err) {
    console.error("[DocumentsController] Error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const getSearchStats = async (req, res) => {
  try {
    const stats = await getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error("[StatsController] Error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export default {
  search,
  listDocuments,
  getSearchStats,
};
