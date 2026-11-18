/**
 * RD4.3 | PART B | PRODUCT ROUTES AND PDF UPLOAD
 *
 * LESSON: What is an Express Router?
 * A Router groups related URL endpoints in one module.
 *
 * LESSON: GET versus POST
 * GET retrieves pages or data.
 * POST submits data, including uploaded files.
 *
 * LESSON: What is a transaction?
 * A transaction ensures related database changes
 * either succeed together or are rolled back.
 *
 * SEARCH KEYWORDS:
 * Express Router, GET, POST, SQL JOIN, PDF upload,
 * middleware, transaction, foreign key, CRUD
 */

const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const db = require('./db');
const { generateEmbedding } = require('./embedding');
const { generateAnswer } = require('./gemini');


const router = express.Router();

router.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp'
}));

const uploadDir = path.join(__dirname, 'uploads');

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// LESSON: LEFT JOIN keeps products even without a PDF.
router.get('/', async (req, res, next) => {
  try {
    const [products] = await db.query(`
      SELECT p.product_id, p.name, p.description,
             pdf.pdf_id, pdf.original_filename
      FROM Products p
      LEFT JOIN PDF pdf ON p.pdf_id = pdf.pdf_id
      ORDER BY p.product_id
    `);

    res.render('products/index', { products });
  } catch (error) {
    next(error);
  }
});

// LESSON: Parameterized queries prevent SQL injection.

/**
 * RD4.3 | PART D | SEMANTIC PRODUCT SEARCH
 *
 * LESSON: Search PDF content by meaning, not exact words.
 * VEC_DISTANCE_COSINE compares the query vector with
 * stored document vectors.
 *
 * SEARCH KEYWORDS: semantic search, cosine distance, SQL JOIN
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();

    if (!query) return res.redirect('/products');
    if (query.length > 2000) {
      return res.status(400).send('Search query is too long');
    }

    const embedding = await generateEmbedding(query);

    const [results] = await db.execute(`
      SELECT
        p.product_id,
        p.name,
        p.description,
        c.content AS chunk_text,
        VEC_DISTANCE_COSINE(
          c.embedding, VEC_FromText(?)
        ) AS distance
      FROM PDFChunks c
      JOIN PDF pdf ON c.pdf_id = pdf.pdf_id
      JOIN Products p ON p.pdf_id = pdf.pdf_id
      ORDER BY distance ASC
      LIMIT 10
    `, [JSON.stringify(embedding)]);

    res.render('products/search', { query, results });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).send('Invalid product ID');

    const [rows] = await db.execute(`
      SELECT p.*, pdf.original_filename, pdf.uploaded_at
      FROM Products p
      LEFT JOIN PDF pdf ON p.pdf_id = pdf.pdf_id
      WHERE p.product_id = ?
    `, [id]);

    if (!rows.length) return res.status(404).send('Product not found');

    res.render('products/details', { product: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/upload', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).send('Invalid product ID');

    const [rows] = await db.execute(
      'SELECT product_id, name FROM Products WHERE product_id = ?',
      [id]
    );

    if (!rows.length) return res.status(404).send('Product not found');

    res.render('products/upload', { product: rows[0] });
  } catch (error) {
    next(error);
  }
});

// LESSON: A file is stored on disk; its metadata is stored in SQL.
router.post('/:id/upload', async (req, res, next) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).send('Invalid product ID');

  const pdf = req.files?.pdf;
  if (!pdf || Array.isArray(pdf)) {
    return res.status(400).send('Please select one PDF file');
  }

  if (!path.extname(pdf.name).toLowerCase().includes('.pdf') ||
      !pdf.name.toLowerCase().endsWith('.pdf')) {
    return res.status(400).send('Only PDF files are allowed');
  }

  let connection;
  let savedPath;

  try {
    const [products] = await db.execute(
      'SELECT product_id FROM Products WHERE product_id = ?',
      [id]
    );

    if (!products.length) return res.status(404).send('Product not found');

    // Verify the PDF file signature, not just its extension.
    const handle = await fs.open(pdf.tempFilePath, 'r');
    let signature;
    try {
      const buffer = Buffer.alloc(5);
      const { bytesRead } = await handle.read(buffer, 0, 5, 0);
      signature = bytesRead === 5 ? buffer.toString('ascii') : '';
    } finally {
      await handle.close();
    }

    if (signature !== '%PDF-') {
      return res.status(400).send('The uploaded file is not a valid PDF');
    }

    await fs.mkdir(uploadDir, { recursive: true });

    const filename = crypto.randomUUID() + '.pdf';
    savedPath = path.join(uploadDir, filename);
    await pdf.mv(savedPath);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      INSERT INTO PDF
      (filename, original_filename, filepath, file_size)
      VALUES (?, ?, ?, ?)
    `, [filename, path.basename(pdf.name), savedPath, pdf.size]);

    await connection.execute(
      'UPDATE Products SET pdf_id = ? WHERE product_id = ?',
      [result.insertId, id]
    );

    await connection.commit();

    res.redirect('/products/' + id);
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    if (savedPath) {
      await fs.unlink(savedPath).catch(() => {});
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
});


/**
 * RD4.3 | PART E | CHAT WITH PRODUCT PDF
 *
 * LESSON:
 * 1. Embed the question.
 * 2. Retrieve five relevant PDF chunks.
 * 3. Send their text to Gemini as context.
 * 4. Return the generated answer as JSON.
 *
 * SEARCH KEYWORDS: RAG, chat, JSON, POST, retrieval
 */
router.post('/:id/chat', express.json(), async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const question = String(req.body?.question || '').trim();

    if (!id || !question || question.length > 2000) {
      return res.status(400).json({
        error: 'A valid product and question are required'
      });
    }

    const [products] = await db.execute(
      'SELECT pdf_id FROM Products WHERE product_id = ?',
      [id]
    );

    if (!products.length || !products[0].pdf_id) {
      return res.status(404).json({
        error: 'No PDF found for this product'
      });
    }

    const embedding = await generateEmbedding(question);

    const [chunks] = await db.execute(`
      SELECT content,
             VEC_DISTANCE_COSINE(
               embedding, VEC_FromText(?)
             ) AS distance
      FROM PDFChunks
      WHERE pdf_id = ?
      ORDER BY distance ASC
      LIMIT 5
    `, [
      JSON.stringify(embedding),
      products[0].pdf_id
    ]);

    if (!chunks.length) {
      return res.json({
        answer: 'This PDF has not been indexed yet.'
      });
    }

    const context = chunks.map(chunk => chunk.content).join('\n\n');

    const answer = await generateAnswer(question, context);

    res.json({ answer });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
