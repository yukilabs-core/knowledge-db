import { searchDocuments, getDocuments, getStats } from '../services/searchService.js';

export const search = async (req, res) => {
  try {
    const { query, limit = 10, offset = 0 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'query parameter is required'
      });
    }

    const results = await searchDocuments(query, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    console.error('[SearchController] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export const listDocuments = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const documents = await getDocuments(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: documents
    });
  } catch (err) {
    console.error('[DocumentsController] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export const getSearchStats = async (req, res) => {
  try {
    const stats = await getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[StatsController] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

export default {
  search,
  listDocuments,
  getSearchStats
};
