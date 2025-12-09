// api/index.js - Home page
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.status(200).json({
    message: "🔗 Link Preview API",
    status: "Online ✅",
    endpoint: "/api/preview?url=YOUR_URL",
    examples: [
      "/api/preview?url=https://github.com",
      "/api/preview?url=https://chat.whatsapp.com/Lx4ghKdTOeK6ehjra1K1cl",
      "/api/preview?url=https://nodejs.org"
    ],
    github: "https://github.com/CyberCoder225/link-preview-api"
  });
}
