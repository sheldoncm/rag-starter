/**
 * RD4.3 | PART C | STORE VECTOR EMBEDDINGS
 *
 * LESSON: What is vector storage?
 * Saving numerical representations of text in a database.
 *
 * LESSON: What is VEC_FromText()?
 * A MariaDB function that converts a JSON-style array
 * of numbers into its native VECTOR data type.
 *
 * LESSON: Why use a transaction?
 * If any chunk fails, all changes are rolled back.
 * This prevents partially indexed documents.
 *
 * HOW IT WORKS:
 * 1. Find the product's uploaded PDF.
 * 2. Extract text and divide it into chunks.
 * 3. Request one embedding per chunk from OpenRouter.
 * 4. Check that every embedding has 768 dimensions.
 * 5. Store text and vectors in PDFChunks.
 *
 * SEARCH KEYWORDS:
 * RD4.3, embedding, VECTOR(768), VEC_FromText,
 * MariaDB, transaction, rollback, RAG
 */

require('dotenv').config({ quiet: true });

const db = require('./db');
const { extractPDFText, chunkText } = require('./rag');

const EMBEDDING_URL =
  'https://openrouter.ai/api/v1/embeddings';

// RD4.3 | EMBEDDING GENERATION
async function generateEmbedding(text) {
  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_EMBED_MODEL,
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API returned HTTP ${response.status}`);
  }

  const result = await response.json();
  const vector = result.data?.[0]?.embedding;

  if (
    !Array.isArray(vector) ||
    vector.length !== 768 ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error('Invalid embedding: expected 768 finite numbers');
  }

  return vector;
}

// RD4.3 | DOCUMENT INDEXING
async function indexProduct(productId) {
  const [rows] = await db.execute(`
    SELECT p.product_id, p.name,
           pdf.pdf_id, pdf.filepath
    FROM Products p
    JOIN PDF pdf ON p.pdf_id = pdf.pdf_id
    WHERE p.product_id = ?
  `, [productId]);

  if (!rows.length) {
    throw new Error('Product with uploaded PDF not found');
  }

  const product = rows[0];
  const text = await extractPDFText(product.filepath);
  const chunks = chunkText(text);

  if (!chunks.length) {
    throw new Error('No readable text found in PDF');
  }

  console.log('Product:', product.name);
  console.log('Chunks to index:', chunks.length);

  // Generate embeddings before beginning the transaction.
  // This avoids holding database locks during API calls.
  const embeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating embedding ${i + 1}/${chunks.length}`);
    embeddings.push(await generateEmbedding(chunks[i]));
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // LESSON: Re-indexing replaces existing chunks.
    // This prevents duplicate embeddings.
    await connection.execute(
      'DELETE FROM PDFChunks WHERE pdf_id = ?',
      [product.pdf_id]
    );

    for (let i = 0; i < chunks.length; i++) {
      await connection.execute(`
        INSERT INTO PDFChunks
          (pdf_id, chunk_index, content, embedding)
        VALUES (?, ?, ?, VEC_FromText(?))
      `, [
        product.pdf_id,
        i,
        chunks[i],
        JSON.stringify(embeddings[i])
      ]);
    }

    await connection.commit();
    console.log('SUCCESS: All embeddings stored in MariaDB');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// RD4.3 | COMMAND-LINE EXECUTION
(async () => {
  try {
    const productId = Number(process.argv[2]);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new Error('Provide a valid product ID');
    }

    await indexProduct(productId);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
