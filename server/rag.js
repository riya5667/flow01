const { HfInference } = require('@huggingface/inference');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, 'vector_store.json');

let hf = null;

// Initialize HF dynamically so we can check if token exists
const initHF = () => {
  if (!hf && process.env.HF_TOKEN) {
    hf = new HfInference(process.env.HF_TOKEN);
  }
};

const isHFReady = () => {
  initHF();
  return !!hf;
};

// Load store
const loadStore = () => {
  if (fs.existsSync(STORE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch (e) {
      console.error('Error reading vector store:', e);
      return [];
    }
  }
  return [];
};

// Save store
const saveStore = (store) => {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
};

// Chunk text roughly by sentences/size
const chunkText = (text, maxChars = 1000) => {
  const chunks = [];
  let current = '';
  // Split by simple punctuation + space
  const sentences = text.split(/(?<=[.?!])\s+/);
  
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence + ' ';
    } else {
      current += sentence + ' ';
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

// Generate embedding
const getEmbedding = async (text) => {
  if (!isHFReady()) throw new Error('HF_TOKEN is missing in .env');
  const result = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text,
  });
  // HF returns an array or multidimensional array depending on input type.
  // We send a string, it usually returns an array of floats.
  return Array.isArray(result[0]) ? result[0] : result;
};

// Cosine similarity
const cosineSimilarity = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const ingestDocument = async (text, metadata = {}) => {
  const chunks = chunkText(text);
  const store = loadStore();
  let added = 0;
  
  for (const chunk of chunks) {
    if (!chunk) continue;
    try {
      const embedding = await getEmbedding(chunk);
      store.push({
        text: chunk,
        embedding,
        metadata,
        timestamp: new Date().toISOString()
      });
      added++;
    } catch (e) {
      console.error('Error generating embedding for chunk:', e.message);
    }
  }
  
  if (added > 0) saveStore(store);
  return added;
};

const searchSimilar = async (query, topK = 3) => {
  const store = loadStore();
  if (store.length === 0) return [];
  if (!isHFReady()) return []; // Can't search without embeddings
  
  try {
    const queryEmbedding = await getEmbedding(query);
    
    const results = store.map(item => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }));
    
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, topK).map(r => r.text);
  } catch (e) {
    console.error('Error during similarity search:', e.message);
    return [];
  }
};

module.exports = {
  isHFReady,
  ingestDocument,
  searchSimilar
};
