-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  source_url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  authors TEXT,
  published_at TIMESTAMP,
  collected_at TIMESTAMP DEFAULT NOW(),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Full Text Search index
CREATE INDEX IF NOT EXISTS idx_document_search ON documents
  USING gin(to_tsvector('english', title || ' ' || COALESCE(abstract, '')));

-- Other useful indexes
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_published_at ON documents(published_at DESC);

-- Crawl jobs table
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  target_url TEXT,
  job_status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  error_message TEXT,
  documents_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(job_status);

-- Search logs table
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  result_count INT,
  response_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Grant permissions (for public access to read)
-- GRANT SELECT ON documents, search_logs TO public;
-- GRANT SELECT, INSERT ON crawl_jobs TO authenticated;
