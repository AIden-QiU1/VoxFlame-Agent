-- VoxFlame Agent: Update embedding dimension from 1536 to 512
-- Reason: DashScope text-embedding-v3 uses 512 dimensions
-- According to pgvector docs: need to drop index, alter column, recreate index

-- Step 1: Drop the existing HNSW index
DROP INDEX IF EXISTS idx_memories_embedding_hnsw;

-- Step 2: Alter the embedding column dimension
-- Note: This will truncate existing embeddings, but we have none yet
ALTER TABLE memories 
ALTER COLUMN embedding TYPE vector(512);

-- Step 3: Recreate HNSW index with cosine distance
CREATE INDEX idx_memories_embedding_hnsw 
ON memories USING hnsw (embedding vector_cosine_ops);

-- Add comment
COMMENT ON COLUMN memories.embedding IS 'DashScope text-embedding-v3 vector (512 dimensions)';
