import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ 
      error: "Missing ?url= parameter",
      example: "/api/preview?url=https://example.com"
    });
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }
  
  try {
    // Fetch URL
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    
    // Helper functions
    const getMeta = (property) => {
      return $(`meta[property="${property}"]`).attr("content") ||
             $(`meta[name="${property}"]`).attr("content") ||
             null;
    };
    
    const getFavicon = () => {
      const icon = $('link[rel="icon"]').attr("href") ||
                   $('link[rel="shortcut icon"]').attr("href") ||
                   "/favicon.ico";
      
      if (icon.startsWith('http')) return icon;
      
      try {
        const baseUrl = new URL(url);
        return new URL(icon, baseUrl.origin).href;
      } catch {
        return icon;
      }
    };
    
    // Build result
    const result = {
      url,
      success: true,
      timestamp: new Date().toISOString(),
      title: getMeta("og:title") || $("title").text()?.trim() || null,
      description: getMeta("og:description") || getMeta("description") || null,
      image: getMeta("og:image") || $("img").first().attr("src") || null,
      favicon: getFavicon(),
      type: "website"
    };
    
    // Platform detection
    if (url.includes("chat.whatsapp.com")) {
      result.type = "whatsapp";
      result.whatsapp = {
        inviteCode: url.split("/").pop(),
        name: result.title
      };
    } else if (url.includes("t.me")) {
      result.type = "telegram";
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error("Error:", error.message);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({ error: "Request timeout" });
      }
      if (error.response) {
        return res.status(502).json({ error: `Server error: ${error.response.status}` });
      }
    }
    
    return res.status(500).json({ 
      error: "Failed to fetch URL",
      details: error.message 
    });
  }
}
