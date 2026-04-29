-- Knowledge Graph Backbone (PostgreSQL)
-- Optimized for relational entity linking and fast joining of complex ontologies

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS researchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department_id UUID REFERENCES departments(id),
    email TEXT UNIQUE,
    biography TEXT
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    lead_researcher_id UUID REFERENCES researchers(id)
);

CREATE TABLE IF NOT EXISTS methodologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    complexity_level TEXT
);

-- Relationship Linking Tables
CREATE TABLE IF NOT EXISTS project_methodologies (
    project_id UUID REFERENCES projects(id),
    methodology_id UUID REFERENCES methodologies(id),
    PRIMARY KEY (project_id, methodology_id)
);

CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    raw_content TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding_id TEXT -- Reference to Vector DB ID
);

-- Knowledge Graph View
CREATE OR REPLACE VIEW knowledge_map AS
SELECT 
    p.title AS project,
    r.name AS researcher,
    d.name AS department,
    m.name AS methodology
FROM projects p
JOIN researchers r ON p.lead_researcher_id = r.id
JOIN departments d ON r.department_id = d.id
JOIN project_methodologies pm ON p.id = pm.project_id
JOIN methodologies m ON pm.methodology_id = m.id;
