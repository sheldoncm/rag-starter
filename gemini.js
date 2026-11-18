/**
 * RD4.3 | PART A | GEMINI THROUGH OPENROUTER
 *
 * LESSON: What is an API?
 * An API allows one application to communicate with
 * another application.
 *
 * LESSON: What is a language model?
 * A model that processes and generates natural language.
 *
 * PURPOSE:
 * Send questions and retrieved PDF context to Gemini.
 *
 * HOW IT WORKS:
 * 1. Our application sends an HTTPS request.
 * 2. OpenRouter forwards it to the selected model.
 * 3. Gemini generates a response.
 * 4. We return that response to our application.
 *
 * SEARCH KEYWORDS:
 * API, OpenRouter, Gemini, prompt, LLM, RAG
 */

require('dotenv').config();

async function generateAnswer(question, context = '') {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is missing');
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: context
              ? 'Answer using only the supplied document context. If the answer is not in the context, say so.'
              : 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: context
              ? `DOCUMENT CONTEXT:\n${context}\n\nQUESTION:\n${question}`
              : question
          }
        ],
        max_tokens: 300
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${error.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { generateAnswer };
