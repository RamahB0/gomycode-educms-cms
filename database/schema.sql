-- EduCMS PostgreSQL schema
-- Roles: admin, editor, author, subscriber (role-based access control)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'author', 'subscriber');
CREATE TYPE post_status AS ENUM ('draft', 'pending', 'published', 'archived');
CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'spam', 'trash');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(180) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'subscriber',
    avatar_url      TEXT,
    bio             TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- categories (self-referencing for nested categories)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    slug            VARCHAR(140) NOT NULL UNIQUE,
    description     TEXT,
    parent_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
CREATE TABLE posts (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    slug                VARCHAR(280) NOT NULL UNIQUE,
    excerpt             VARCHAR(500),
    content             TEXT NOT NULL,
    featured_image_url  TEXT,
    status              post_status NOT NULL DEFAULT 'draft',
    author_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    view_count          INTEGER NOT NULL DEFAULT 0,
    -- SEO fields
    seo_title           VARCHAR(255),
    seo_description     VARCHAR(500),
    seo_keywords        VARCHAR(255),
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);

-- ---------------------------------------------------------------------------
-- tags & post_tags (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(80) NOT NULL,
    slug    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- comments (self-referencing for threaded replies)
-- ---------------------------------------------------------------------------
CREATE TABLE comments (
    id              SERIAL PRIMARY KEY,
    post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    parent_id       INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    author_name     VARCHAR(120),
    author_email    VARCHAR(180),
    body            TEXT NOT NULL,
    status          comment_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_status ON comments(status);

-- ---------------------------------------------------------------------------
-- media (uploaded files)
-- ---------------------------------------------------------------------------
CREATE TABLE media (
    id              SERIAL PRIMARY KEY,
    uploader_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       TEXT NOT NULL,
    mime_type       VARCHAR(120),
    size_bytes      INTEGER,
    alt_text        VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- activity_log (audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE activity_log (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(80) NOT NULL,
    entity_type     VARCHAR(60) NOT NULL,
    entity_id       INTEGER,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- views
-- ---------------------------------------------------------------------------
CREATE VIEW published_posts_view AS
SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image_url, p.view_count,
       p.published_at, u.name AS author_name, c.name AS category_name
FROM posts p
JOIN users u ON u.id = p.author_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.status = 'published';

CREATE VIEW post_comment_counts_view AS
SELECT post_id, COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
       COUNT(*) AS total_count
FROM comments
GROUP BY post_id;

-- ---------------------------------------------------------------------------
-- seed data
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Site Admin', 'admin@educms.dev', '$2a$10$placeholderplaceholderplaceholderpl', 'admin'),
    ('Eve Editor', 'editor@educms.dev', '$2a$10$placeholderplaceholderplaceholderpl', 'editor'),
    ('Alan Author', 'author@educms.dev', '$2a$10$placeholderplaceholderplaceholderpl', 'author'),
    ('Sam Subscriber', 'subscriber@educms.dev', '$2a$10$placeholderplaceholderplaceholderpl', 'subscriber');

INSERT INTO categories (name, slug, description) VALUES
    ('Web Development', 'web-development', 'Articles about building for the web'),
    ('Data Science', 'data-science', 'Articles about data and machine learning'),
    ('Career', 'career', 'Career growth and job-search advice');

INSERT INTO tags (name, slug) VALUES
    ('javascript', 'javascript'),
    ('postgresql', 'postgresql'),
    ('react', 'react'),
    ('career-tips', 'career-tips');

INSERT INTO posts (title, slug, excerpt, content, status, author_id, category_id, seo_title, seo_description, seo_keywords, published_at) VALUES
    ('Getting Started with EduCMS', 'getting-started-with-educms',
     'A quick tour of the EduCMS content platform.',
     'EduCMS is a role-based content management system built with Node.js, Express and PostgreSQL. This post walks through creating your first article.',
     'published', 3, 1, 'Getting Started with EduCMS', 'A quick tour of the EduCMS content platform.', 'cms, educms, getting started', now()),
    ('Designing a Role-Based Access Control System', 'designing-rbac',
     'How EduCMS separates Admin, Editor, Author and Subscriber permissions.',
     'Role-based access control (RBAC) lets a CMS grant different capabilities to different kinds of users. In EduCMS, Admins manage everything, Editors manage content, Authors manage their own posts, and Subscribers can only comment.',
     'published', 2, 1, NULL, NULL, NULL, now());

INSERT INTO post_tags (post_id, tag_id) VALUES (1, 1), (1, 2), (2, 1);

INSERT INTO comments (post_id, user_id, author_name, author_email, body, status) VALUES
    (1, 4, 'Sam Subscriber', 'subscriber@educms.dev', 'Great introduction, thanks!', 'approved');
