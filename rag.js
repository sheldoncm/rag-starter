/**
 * RD4.3 | PART C | RETRIEVAL-AUGMENTED GENERATION
 *
 * LESSON: What is RAG?
 * RAG retrieves relevant information from documents
 * before an AI model generates its answer.
 *
 * LESSON: What is PDF text extraction?
 * Reading text content from a PDF document.
 *
 * LESSON: What is chunking?
 * Dividing long text into smaller searchable sections.
 *
 * HOW IT WORKS:
 * 1. Read the uploaded PDF.
 * 2. Extract its text.
 * 3. Split text into chunks.
 * 4. Later: generate embeddings for each chunk.
 * 5. Later: store embeddings in MariaDB.
 *
 * SEARCH KEYWORDS:
 * RD4.3, RAG, PDFParse, text extraction,
 * chunking, embeddings, vector database
 */

const fs = require('fs/promises');
const { PDFParse } = require('pdf-parse');

// RD4.3 | PDF EXTRACTION
async function extractPDFText(filePath) {
  const buffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: new Uint8Array(buffer)
  });

  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

// RD4.3 | CHUNKING
// Split text into overlapping chunks so information
// near chunk boundaries is less likely to be lost.
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error('Invalid chunk settings');
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks = [];

  for (let start = 0; start < cleaned.length;) {
    const chunk = cleaned.slice(start, start + chunkSize);
    if (!chunk) break;

    chunks.push(chunk);

    if (start + chunkSize >= cleaned.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

module.exports = {
  extractPDFText,
  chunkText
};
