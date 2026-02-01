import express from 'express';
import compression from 'compression';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Setup __dirname for ESM context (required because we are using ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Use node.js json middleware
app.use(express.json());

// Make Express pass '2' as the 3rd argument to `JSON.stringify()` for pretty printing
app.set('json spaces', 2);

// Compress all HTTP responses using node.js compression middleware
app.use(compression({
  filter: (req, res) => {
    // Fallback: If a header explicitly asks for no compression, skip it
    if (req.headers['x-no-compression']) return false;
    // Otherwise use standard filter
    return compression.filter(req, res);
  }
}));

// Load resources synchronously at startup
const resources = JSON.parse(readFileSync(join(__dirname, 'resources.json'), 'utf-8'));

/*
Function to validate resource input
*/
function validateResource(body) {
  if (!body.text || typeof body.text !== 'string' || body.text.trim().length < 3) {
    return { error: 'Text is required and must be at least 3 characters long.' };
  }
  return { error: null };
}

/*
Function to escape special regex characters
Prevents server crashes if users search for characters like "[" or "*"
*/
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// READ Request Handlers
/*
route = /api/resources
action = GET: retrieve and list all resources (with optional limit)
*/
app.get('/api/resources', (req, res) => {
  let limit = parseInt(req.query.limit) || 10;
  res.status(200).json(resources.slice(0, limit));
});

// READ Request Handler for searching resources and returning matches
/*
route = /api/resources/search?q=ADD-QUERY-HERE
action = GET: search and retrieve resources by matching string in text field
*/
app.get('/api/resources/search', (req, res) => {
  let q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  try {
    // Use escapeRegex to sanitize input before creating RegExp
    const regex = new RegExp(escapeRegex(q), "i");
    const results = resources.filter(item => regex.test(item.text));
    
    if (results.length === 0) {
      return res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Could not find that resource.</h2>');
    }
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

// READ Request Handler for single resource using id
/*
route = /api/resource/id
action = GET: find and retrieve resource by id
*/
app.get('/api/resource/:id', (req, res) => {
  const resource = resources.find(item => item.id === req.params.id);
  if (!resource) return res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Could not find that resource.</h2>');
  res.status(200).json(resource);
});

// READ Request Handler for retrieving single random resource
/*
route = /api/resource/random
action = GET: retrieve random single resource
*/
app.get('/api/resource/random', (req, res) => {
  // Optimization: Direct array access is faster than Object.values()
  const randomResource = resources[Math.floor(Math.random() * resources.length)];
  
  if (!randomResource) return res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Could not find that resource.</h2>');

  let format = req.query.format;
  if (format === "text") {
    res.status(200).send(randomResource.text);
  } else {
    res.status(200).json(randomResource);
  }
});

// CREATE Request Handler
/*
route = /api/resources
action = POST: creates a new resource
*/
app.post('/api/resources', (req, res) => {
  const { error } = validateResource(req.body);
  if (error) {
    res.status(400).send(error);
    return;
  }
  
  const resource = {
    id: String(resources.length + 1), // Ensure ID is a string for consistency
    creator: req.body.creator || "Unknown",
    text: req.body.text
  };
  
  resources.push(resource);
  res.status(201).json(resource);
});

// UPDATE Request Handler for single resource using id
/*
route = /api/resource/id
action = PUT: retrieve and update resource by id
*/
app.put('/api/resource/:id', (req, res) => {
  const resource = resources.find(item => item.id === req.params.id);
  if (!resource) return res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Could not find that resource to update.</h2>');
  
  const { error } = validateResource(req.body);
  if (error) {
    res.status(400).send(error);
    return;
  }
  
  resource.text = req.body.text;
  res.status(200).json(resource);
});

// DELETE Request Handler for single resource using id
/*
route = /api/resource/id
action = DELETE: retrieve and delete resource by id
*/
app.delete('/api/resource/:id', (req, res) => {
  const index = resources.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).send('<h2 style="font-family: Malgun Gothic; color: darkred;">Could not find that resource to delete.</h2>');
  
  const [deletedResource] = resources.splice(index, 1);
  res.status(200).json(deletedResource);
});

// Default READ Request Handler route and index page
app.get('*', (req, res) => {
  res.status(200).sendFile(join(__dirname, 'index.html'));
});

// PORT ENVIRONMENT VARIABLE
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Listening on port ${port}..`));