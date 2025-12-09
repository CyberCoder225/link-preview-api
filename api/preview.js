import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ 
      error: "Missing URL parameter", 
      example: "/api/preview?url=https://example.com" 
    });
  }

  // URL validation
  function isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  if (!isValidURL(url)) {
    return res.status(400).json({ 
      error: "Invalid URL format",
      example: "https://example.com" 
    });
  }

  // Helper functions
  function getMeta($, property) {
    return (
      $(`meta[property="${property}"]`).attr("content") ||
      $(`meta[name="${property}"]`).attr("content") ||
      null
    );
  }

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

  try {
    const response = await axios.get(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml"
      },
      timeout: 8000, // Reduced for Vercel's 10s limit
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

    // Return success response
    res.status(200).json(result);

  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    
    // Handle specific errors
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED") {
        return res.status(408).json({ error: "Request timeout (8s limit)" });
      }
      if (err.response) {
        return res.status(502).json({ 
          error: `Failed to fetch URL (${err.response.status})`,
          details: err.response.statusText
        });
      }
      if (err.request) {
        return res.status(502).json({ error: "No response from server" });
      }
    }
    
    // Generic error
    res.status(500).json({ 
      error: "Failed to load URL", 
      details: err.message 
    });
  }
}
