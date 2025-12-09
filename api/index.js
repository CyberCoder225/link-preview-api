// api/index.js - Home page
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.status(200).json({
    message: "🔗 Link Preview API",
    status: "Online ✅",
    endpoint: "/api/preview?url=YOUR_URL",
    examples: [
      "https://link-preview-api-omega.vercel.app/api/preview?url=https://github.com",
      "https://link-preview-api-omega.vercel.app/api/preview?url=https://chat.whatsapp.com/Lx4ghKdTOeK6ehjra1K1cl",
      "https://link-preview-api-omega.vercel.app/api/preview?url=https://nodejs.org"
    ],
    github: "https://github.com/CyberCoder225/link-preview-api"
  });
}
