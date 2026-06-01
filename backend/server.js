/**
 * server.js
 *
 * Starts the Express web server and exposes the analyze API.
 * Run: npm start  (from the backend folder)
 */

const path = require("path");
const dotenv = require("dotenv");

// Load backend/.env before trustAnalyzer (must live next to server.js, NOT in node_modules/)
const envPath = path.join(__dirname, ".env");
const envResult = dotenv.config({ path: envPath });

const express = require("express");
const cors = require("cors");
const { analyzeInternshipUrl, isWhoisConfigured } = require("./trustAnalyzer");

const app = express();
const PORT = process.env.PORT || 3001;

// Allow the React app (different port) to call this API
app.use(cors());
app.use(express.json());

// Health check — useful to confirm the server is running
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "InternShield API is running" });
});

/**
 * POST /api/analyze
 * Body: { "url": "https://example.com/internship" }
 * Response: { trustScore, riskIndicators, urlChecked, domain, domainAgeDays }
 */
app.post("/api/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      error: "Please send a JSON body with a string field: url",
    });
  }

  try {
    const result = await analyzeInternshipUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || "Analysis failed" });
  }
});

app.listen(PORT, () => {
  console.log(`InternShield backend listening on http://localhost:${PORT}`);

  if (!isWhoisConfigured()) {
    if (envResult.error) {
      console.warn(`WHOIS: no .env file at ${envPath} — copy .env.example to .env`);
    } else {
      console.warn("WHOIS: WHOIS_API_KEY is empty in .env — domain age checks will be skipped");
    }
  } else {
    console.log("WHOIS: API key loaded from .env");
  }
});
