/**
 * RD4.3 | PART C | SEMANTIC SEARCH AND RAG
 *
 * LESSON: What is semantic search?
 * Searching by meaning rather than exact keywords.
 *
 * LESSON: What is cosine distance?
 * A measure of how different two vectors are.
 * Lower distance means greater similarity.
 *
 * LESSON: What is Retrieval-Augmented Generation?
 * Retrieve relevant document chunks, then give
 * those chunks to an AI model as supporting context.
 *
 * HOW IT WORKS:
 * 1. User selects a product and asks a question.
 * 2. OpenRouter converts the question into a vector.
 * 3. MariaDB finds the closest PDF chunk vectors.
 * 4. Gemini answers using the retrieved PDF text.
 *
 * SEARCH KEYWORDS:
 * RD4.3, RAG, semantic search, cosine distance,
 * VEC_DISTANCE_COSINE, OpenRouter, Gemini
 */

const express = require('express');
const db = require('./db');
const { generateAnswer } = require('./gemini');

const router = express.Router();

async function generateQueryEmbedding(text) {
  const response = await fetch(
    'https://openrouter.ai/api/v1/embeddings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_EMBED_MODEL,
        input: text
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding API HTTP ${response.status}`);
  }

  const result = await response.json();
  const vector = result.data?.[0]?.embedding;

  if (!Array.isArray(vector) ||
      vector.length !== 768 ||
      !vector.every(Number.isFinite)) {
    throw new Error('Expected a valid 768-dimensional embedding');
  }

  return vector;
}

// RD4.3 | GET | DISPLAY QUESTION FORM
router.get('/', async (req, res, next) => {
  try {
    const [products] = await db.query(`
      SELECT p.product_id, p.name,
             COUNT(c.chunk_id) AS chunk_count
      FROM Products p
      LEFT JOIN PDF pdf ON p.pdf_id = pdf.pdf_id
      LEFT JOIN PDFChunks c ON c.pdf_id = pdf.pdf_id
      GROUP BY p.product_id, p.name
      ORDER BY p.name
    `);

    res.render('rag/index', {
      products,
      answer: null,
      sources: [],
      question: '',
      selectedProduct: ''
    });
  } catch (error) {
    next(error);
  }
});

// RD4.3 | POST | ASK QUESTION
router.post('/', async (req, res, next) => {
  try {
    const productId = Number(req.body.product_id);
    const question = String(req.body.question || '').trim();

    if (!Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !question ||
        question.length > 2000) {
      return res.status(400).send('Invalid product or question');
    }

    const [products] = await db.query(`
      SELECT p.product_id, p.name,
             COUNT(c.chunk_id) AS chunk_count
      FROM Products p
      LEFT JOIN PDF pdf ON p.pdf_id = pdf.pdf_id
      LEFT JOIN PDFChunks c ON c.pdf_id = pdf.pdf_id
      GROUP BY p.product_id, p.name
      ORDER BY p.name
    `);

    const selected = products.find(
      p => p.product_id === productId
    );

    if (!selected || Number(selected.chunk_count) === 0) {
      return res.status(400).send(
        'This product has no indexed PDF'
      );
    }

    // LESSON: Embed the user's question.
    const vector = await generateQueryEmbedding(question);

    // LESSON: Retrieve the three closest text chunks.
    // VEC_DISTANCE_COSINE returns a distance.
    // Smaller values indicate greater similarity.
    const [sources] = await db.execute(`
      SELECT c.chunk_index, c.content,
             VEC_DISTANCE_COSINE(
               c.embedding, VEC_FromText(?)
             ) AS distance
      FROM PDFChunks c
      JOIN PDF pdf ON c.pdf_id = pdf.pdf_id
      JOIN Products p ON p.pdf_id = pdf.pdf_id
      WHERE p.product_id = ?
      ORDER BY distance ASC
      LIMIT 3
    `, [JSON.stringify(vector), productId]);

    // LESSON: Ground the AI answer in retrieved evidence.
    const context = sources.map((source, index) =>
      `[Source ${index + 1}, chunk ${source.chunk_index}]\n` +
      source.content
    ).join('\n\n');

    const answer = await generateAnswer(question, context);

    res.render('rag/index', {
      products,
      answer,
      sources,
      question,
      selectedProduct: String(productId)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
