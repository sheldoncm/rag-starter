/**
 * RD4.3 | PART C | EMBEDDING API TEST
 *
 * LESSON: An embedding represents text as numbers.
 * PURPOSE: Verify that OpenRouter returns 768 numbers.
 *
 * WHY 768?
 * Our MariaDB column uses VECTOR(768).
 * The embedding dimensions must match.
 *
 * SEARCH KEYWORDS:
 * OpenRouter, embedding, vector, dimensions, RAG
 */

require('dotenv').config({ quiet: true });

async function testEmbedding() {
  const model = process.env.OPENROUTER_EMBED_MODEL;

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is missing');
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/embeddings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: 'HorizonPath 2045 retirement investment strategy'
      })
    }
  );

  if (!response.ok) {
    // Display the HTTP status without printing credentials
    // or potentially sensitive provider response details.
    throw new Error(
      `Embedding request failed: HTTP ${response.status}`
    );
  }

  const result = await response.json();
  const vector = result.data?.[0]?.embedding;

  if (!Array.isArray(vector)) {
    throw new Error('No embedding array returned');
  }

  console.log('Model:', model);
  console.log('Dimensions:', vector.length);
  console.log('Numeric values:', vector.every(Number.isFinite));

  if (vector.length !== 768) {
    throw new Error(
      `Expected 768 dimensions, received ${vector.length}`
    );
  }

  console.log('SUCCESS: Compatible with MariaDB VECTOR(768)');
}

testEmbedding().catch(error => {
  console.error('TEST ERROR:', error.message);
  process.exitCode = 1;
});
