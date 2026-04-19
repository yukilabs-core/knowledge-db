import express from 'express';
import searchController from '../controllers/searchController.js';

const router = express.Router();

// Search endpoint
router.post('/search', searchController.search);

// List all documents
router.get('/documents', searchController.listDocuments);

// Get statistics
router.get('/stats', searchController.getSearchStats);

export default router;
