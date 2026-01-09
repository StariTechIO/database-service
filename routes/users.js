const express = require('express');
const db = require('../db');
const router = express.Router();

// POST /users - Create a new user
router.post('/', async (req, res) => {
  try {
    const { email, email_verified, password_hash, sso_providers, roles, status } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    if (!password_hash && !sso_providers) {
      return res.status(400).json({ error: 'Either password_hash or sso_providers is required' });
    }

    const result = await db.query(
      `INSERT INTO users (email, email_verified, password_hash, sso_providers, roles, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        email,
        email_verified ?? false,
        password_hash ?? null,
        sso_providers ? JSON.stringify(sso_providers) : null,
        roles ?? ['user'],
        status ?? 'active',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/by-email/:email - Get user by email
// NOTE: This must come BEFORE /:id to avoid "by-email" being matched as an id
router.get('/by-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user by email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/by-sso?provider=xxx&provider_id=xxx - Get user by SSO provider
// NOTE: This must come BEFORE /:id to avoid "by-sso" being matched as an id
router.get('/by-sso', async (req, res) => {
  try {
    const { provider, provider_id } = req.query;

    if (!provider || !provider_id) {
      return res.status(400).json({ error: 'provider and provider_id are required' });
    }

    const result = await db.query(
      `SELECT * FROM users 
       WHERE sso_providers @> $1::jsonb`,
      [JSON.stringify([{ provider, provider_id }])]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user by SSO:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id - Get user by UUID
// NOTE: This must come AFTER specific routes like /by-email and /by-sso
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/:id - Update user
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Build dynamic update query
    const allowedFields = ['email', 'email_verified', 'password_hash', 'sso_providers', 'roles', 'status'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'sso_providers') {
          setClauses.push(`${field} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(updates[field]));
        } else if (field === 'roles') {
          setClauses.push(`${field} = $${paramIndex}::text[]`);
          values.push(updates[field]);
        } else {
          setClauses.push(`${field} = $${paramIndex}`);
          values.push(updates[field]);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at
    setClauses.push(`updated_at = NOW()`);

    // Add id as last parameter
    values.push(id);

    const query = `
      UPDATE users 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'User must have at least one auth method (password_hash or sso_providers)' });
    }
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
