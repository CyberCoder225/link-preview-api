import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

// Initialize
const app = express();

// Middleware - Enable CORS for all origins (important for Vercel)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// URL validation
function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Extract meta tags
function getMeta($, property) {
  return (
    $(`meta[property="${property}"]`).attr("content") ||
    $(`meta[name="${property}"]`).attr("content") ||
    null
  );
}

// Get favicon
function getFavicon($, baseUrl) {
  const icon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href") ||
    "/favicon.ico";

  if (!icon.startsWith("http")) {
    try {
      const urlObj = new URL(baseUrl);
      return new URL(icon, `${urlObj.protocol}//${urlObj.host}`).href;
    } catch {
      return null;
    }
  }
  return icon;
}

// Main API endpoint
app.get("/api/preview", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ 
      error: "Missing URL parameter", 
      example: "/api/preview?url=https://example.com" 
    });
  }

  if (!isValidURL(url)) {
    return res.status(400).json({ 
      error: "Invalid URL format",
      example: "https://example.com" 
    });
  }

  try {
    const response = await axios.get(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml"
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    let result = {
      url,
      type: "website",
      success: true,
      timestamp: new Date().toISOString()
    };

    // Basic metadata
    result.title = getMeta($, "og:title") || $("title").text()?.trim() || null;
    result.description = getMeta($, "og:description") || getMeta($, "description") || null;
    result.image = getMeta($, "og:image") || $("img").first().attr("src") || null;
    result.favicon = getFavicon($, url);
    
    // Extract additional meta tags
    result.meta = {};
    $('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]').each((_, el) => {
      const property = $(el).attr("property") || $(el).attr("name");
      const content = $(el).attr("content");
      if (property && content) {
        result.meta[property.replace(/[:]/g, "_")] = content;
      }
    });

    // Telegram
    if (url.includes("t.me")) {
      result.type = "telegram";
      result.telegram = {
        name: $(".tgme_page_title").text()?.trim() || result.title,
        description: $(".tgme_page_description").text()?.trim() || result.description,
        icon: $(".tgme_page_photo_image").attr("src") || result.image,
        username: $(".tgme_page_link").attr("href")?.replace("https://t.me/", "") || null,
        members: $(".tgme_page_extra").text()?.trim() || null,
        verified: $(".tgme_page_title_verified").length > 0,
      };
      
      const lower = $(".tgme_page_extra").text().toLowerCase();
      result.telegram.type = lower.includes("subscriber") ? "public channel" : 
                           lower.includes("member") ? "group" : "unknown";
    }

    // WhatsApp
    if (url.includes("chat.whatsapp.com") || url.includes("whatsapp.com")) {
      result.type = "whatsapp";
      result.whatsapp = {
        inviteCode: url.split("/").pop(),
        name: getMeta($, "og:title") || $("h1").first().text()?.trim() || result.title,
        description: getMeta($, "og:description") || $("p").first().text()?.trim() || result.description,
        icon: getMeta($, "og:image") || $("img").first().attr("src") || result.image,
      };
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.json(result);

  } catch (err) {
    console.error(`Error: ${err.message}`);
    
    // Set CORS headers for error response too
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED") {
        return res.status(408).json({ error: "Request timeout" });
      }
      if (err.response) {
        return res.status(502).json({ error: `Failed to fetch (${err.response.status})` });
      }
    }
    
    res.status(500).json({ error: "Failed to load URL", details: err.message });
  }
});

// Home route
app.get("/", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    message: "Link Preview API",
    endpoint: "/api/preview?url=YOUR_URL",
    version: "1.0.0",
    deployed: true,
    examples: [
      "/api/preview?url=https://github.com",
      "/api/preview?url=https://telegram.org",
      "/api/preview?url=https://chat.whatsapp.com/your-invite-code"
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(404).json({ error: "Route not found" });
});

// Vercel requires module.exports for serverless
export default app;

// Local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}
