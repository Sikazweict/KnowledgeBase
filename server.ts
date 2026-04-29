import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as dotenv from "dotenv";
import multer from "multer";

dotenv.config();

// Configure Multer for processing file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // In-memory document store for prototype simulation
  const documentStore: any[] = [];

  // --- API Routes ---

  // Store a document processed by the frontend
  app.post("/api/store_document", (req, res) => {
    const { title, type, data } = req.body;
    const docEntry = {
      id: Date.now().toString(),
      title: title || "Untitled Document",
      type: type || "Unknown",
      timestamp: new Date().toISOString(),
      entities: data.entities || [],
      summary: data.summary || "No summary provided."
    };
    documentStore.unshift(docEntry);
    res.json({ success: true, id: docEntry.id });
  });

  // Get all ingested documents
  app.get("/api/documents", (req, res) => {
    res.json({ documents: documentStore });
  });

  // Trend Analytics Simulation
  app.get("/api/analytics", (req, res) => {
    // Static trend data for prototype
    res.json({
      trends: [
        { topic: "Quantum Computing", projected_growth: "15%", confidence: 0.92 },
        { topic: "Edge neural networks", projected_growth: "22%", confidence: 0.88 },
        { topic: "Bio-Informatics", projected_growth: "10%", confidence: 0.85 },
        { topic: "Green Energy Systems", projected_growth: "18%", confidence: 0.90 }
      ]
    });
  });

  // --- Vite / Frontend Setup ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Knowledge Core Operational: http://localhost:${PORT}`);
  });
}

startServer();
