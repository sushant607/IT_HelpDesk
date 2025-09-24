// config/chroma.js
const { CloudClient } = require("chromadb");
require("dotenv").config();

// const client = new ChromaClient({
//   apiKey: process.env.CHROMA_API_KEY,
//   baseUrl: "https://cloud.chromadb.com",  // Chroma Cloud URL
//   tenant: process.env.CHROMA_TENANT
// });

const client = new CloudClient({
  apiKey: 'ck-DrNZVwhE9P7JDumkDCaKfWWuPDYM1XZfr3A5J4UCEp1K',
  tenant: '37dea777-55cb-4b80-be9b-11322059d954',
  database: 'plate'
});

// getOrCreateCollection is async and returns the collection
async function getCollection() {
  return await client.getOrCreateCollection({
    name: process.env.CHROMA_DATABASE,
  });
}

module.exports = getCollection;
