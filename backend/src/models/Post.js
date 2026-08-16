const { query } = require('../config/database');

const SELECT_BASE = `
  SELECT p.*, u.name AS author_name, u.email AS author_email, c.name AS category_name, c.slug AS category_slug
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN categories c ON c.id = p.category_id
`;

async function create({
  title, slug, excerpt, content, featuredImageUrl, status, authorId, categoryId,
  seoTitle, seoDescription, seoKeywords,
}) {
  const publishedAt = status === 'published' ? new Date() : null;
  const { rows } = await query(
    `INSERT INTO posts
       (title, slug, excerpt, content, featured_image_url, status, author_id, category_id,
        seo_title, seo_description, seo_keywords, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [title, slug, excerpt || null, content, featuredImageUrl || null, status || 'draft', authorId,
     categoryId || null, seoTitle || null, seoDescription || null, seoKeywords || null, publishedAt]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`${SELECT_BASE} WHERE p.id = $1`, [id]);
  return rows[0] || null;
}

async function findBySlug(slug) {
  const { rows } = await query(`${SELECT_BASE} WHERE p.slug = $1`, [slug]);
  return rows[0] || null;
}

async function list({ status, categoryId, authorId, search, limit, offset }) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (status) {
    conditions.push(`p.status = $${i++}`);
    params.push(status);
  }
  if (categoryId) {
    conditions.push(`p.category_id = $${i++}`);
    params.push(categoryId);
  }
  if (authorId) {
    conditions.push(`p.author_id = $${i++}`);
    params.push(authorId);
  }
  if (search) {
    conditions.push(`(p.title ILIKE $${i} OR p.content ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `${SELECT_BASE} ${whereClause} ORDER BY p.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM posts p ${whereClause}`,
    params
  );
  return { rows, total: countRows[0].total };
}

async function update(id, fields) {
  const allowed = ['title', 'excerpt', 'content', 'featured_image_url', 'status', 'category_id',
    'seo_title', 'seo_description', 'seo_keywords'];
  const sets = [];
  const params = [id];
  let i = 2;
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    sets.push(`${key} = $${i}`);
    params.push(value);
    i++;
  }
  if (fields.status === 'published') {
    sets.push(`published_at = COALESCE(published_at, now())`);
  }
  if (!sets.length) return findById(id);
  const { rows } = await query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return rows[0] || null;
}

async function remove(id) {
  await query(`DELETE FROM posts WHERE id = $1`, [id]);
}

async function incrementViewCount(id) {
  await query(`UPDATE posts SET view_count = view_count + 1 WHERE id = $1`, [id]);
}

module.exports = { create, findById, findBySlug, list, update, remove, incrementViewCount };
