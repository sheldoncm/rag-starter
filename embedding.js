/**
 * RD4.3 | EMBEDDINGS
 *
 * LESSON: Convert text into a numerical vector.
 * PURPOSE: Reuse the same model for documents and queries.
 * WHY: Different embedding models may produce incompatible vectors.
 *
 * SEARCH KEYWORDS: embedding, OpenRouter, VECTOR(768)
 */

require('dotenv').config({ quiet: true });

async function generateEmbedding(text) {
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

  const data = await response.json();
  const vector = data.data?.[0]?.embedding;

  if (!Array.isArray(vector) ||
      vector.length !== 768 ||
      !vector.every(Number.isFinite)) {
    throw new Error('Expected 768 valid embedding dimensions');
  }

  return vector;
}

module.exports = { generateEmbedding };
