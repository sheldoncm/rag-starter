# RD4.3 — Vector Embeddings and RAG

## PART A — Database and Gemini

### What is a relational database?
A database that stores information in related tables.

### What is a primary key?
A unique identifier for each record in a table.

### What is a foreign key?
A column that references a key in another table.

### What is a database relationship?
A connection between tables using primary and foreign keys.

### What is a vector?
An ordered list of numerical values.

### What is an embedding?
A numerical representation of text that helps compare meaning.

### What is VECTOR(768)?
A MariaDB data type storing a vector with 768 dimensions.

### What is a vector index?
An index that speeds up similarity searches.

## PART B — PDF Uploads

### What is middleware?
A function that processes requests before they reach a route handler.

### What is express-fileupload?
Middleware for receiving uploaded files in Express.

### What is a database transaction?
A group of database operations that succeed or fail together.

## PART C — Retrieval-Augmented Generation

### What is RAG?
Retrieval-Augmented Generation retrieves relevant document content
and supplies it to a language model when generating an answer.

### What is chunking?
Splitting a large document into smaller pieces.

### What is semantic search?
Finding information by meaning rather than exact keywords.

### How does RAG work?
1. Extract text from a PDF.
2. Split text into chunks.
3. Generate an embedding for each chunk.
4. Store chunks and embeddings in MariaDB.
5. Convert a user's question into an embedding.
6. Retrieve relevant chunks using vector similarity.
7. Send the question and retrieved context to Gemini.

## SEARCH KEYWORDS
RD4.3, SQL, primary key, foreign key, transaction,
middleware, PDF, chunking, embedding, vector,
semantic search, Gemini, RAG
