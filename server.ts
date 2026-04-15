import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Client } from "@googlemaps/google-maps-services-js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const mapsClient = new Client({});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/api/routes", async (req, res) => {
  try {
    const { origin, destination } = req.body;
    
    const mockData = {
      planA: {
        summary: "Old Airport Road (Primary)",
        duration: "45 mins",
        distance: "15.2 km",
        polyline: [
          { lat: 12.9698, lng: 77.7499 }, // Whitefield
          { lat: 12.9569, lng: 77.7011 }, // Marathahalli
          { lat: 12.9784, lng: 77.6408 }  // Indiranagar
        ],
        bounds: {
          southwest: { lat: 12.9304, lng: 77.6245 },
          northeast: { lat: 12.9880, lng: 77.7499 }
        }
      },
      planB: {
        summary: "Mahadevapura (Algorithmic Herd)",
        duration: "62 mins",
        distance: "16.5 km",
        polyline: [
          { lat: 12.9698, lng: 77.7499 },
          { lat: 12.9880, lng: 77.6895 },
          { lat: 12.9784, lng: 77.6408 }
        ]
      },
      planC: {
        summary: "Bellandur Outer Ring (Agentic Escape)",
        duration: "41 mins",
        distance: "18.1 km",
        polyline: [
          { lat: 12.9698, lng: 77.7499 },
          { lat: 12.9304, lng: 77.6784 },
          { lat: 12.9352, lng: 77.6245 },
          { lat: 12.9784, lng: 77.6408 }
        ]
      },
      analysis: {
        congestion_delta: "+17 mins",
        capacity_evaluation: "Plan B is a low-capacity residential class. Predictive gridlock imminent.",
        time_to_failure: "04:18.02",
        is_trap: true
      }
    };

    if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY") {
      console.warn("Google Maps API key is missing. Returning sample traffic data.");
      return res.json(mockData);
    }

    // 1. Data Ingestion (The Observer)
    let routes = [];
    try {
      const directionsResponse = await mapsClient.directions({
        params: {
          origin,
          destination,
          alternatives: true,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      routes = directionsResponse.data.routes;
    } catch (mapsError) {
      console.error("Google Maps API Error, falling back to sample data:", mapsError);
      return res.json(mockData);
    }
    
    if (!routes || routes.length === 0) {
      return res.json(mockData);
    }

    // Identify Plan A (primary) and Plan B (alternative)
    const planA = routes[0];
    const planB = routes.length > 1 ? routes[1] : routes[0]; // Fallback if no alternative

    // 2. Agentic Reasoning (The Meta-Predictor)
    // We simulate the Gemini reasoning here by passing the route data to Gemini
    // to evaluate "systemic fragility" and generate a Plan C.
    // In a real scenario, we'd use live traffic data, but we'll use Gemini to "reason" about it.
    
    let aiData: any = {};
    
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is missing or invalid. Using fallback reasoning.");
      // Fallback reasoning if Gemini API key is missing or invalid
      aiData = {
        planB_analysis: {
          congestion_delta: "Unknown (API Key Missing)",
          capacity_evaluation: "Unable to evaluate capacity without AI.",
          time_to_failure: "Unknown",
          is_trap: true
        },
        planC_suggestion: {
          summary: "Fallback Alternative Route",
          reasoning: "Generated without AI due to missing API key.",
          waypoints: []
        }
      };
    } else {
      const prompt = `
        Analyze these two routes from ${origin} to ${destination}.
        Plan A (Primary): ${planA.summary}, Distance: ${planA.legs[0].distance.text}, Duration: ${planA.legs[0].duration.text}.
        Plan B (Algorithmic Herd Alternative): ${planB.summary}, Distance: ${planB.legs[0].distance.text}, Duration: ${planB.legs[0].duration.text}.
        
        The primary route (Plan A) has an incident. Standard algorithms are funneling everyone to Plan B.
        Calculate the "Congestion Delta" and evaluate the capacity of Plan B.
        Trigger a failure state for Plan B ("Trap") and predict the time to total gridlock.
        
        Then, generate a "Plan C" - a mathematically isolated route that avoids the main roads used in Plan A and Plan B.
        Return the response in JSON format with the following structure:
        {
          "planB_analysis": {
            "congestion_delta": "string",
            "capacity_evaluation": "string",
            "time_to_failure": "string",
            "is_trap": boolean
          },
          "planC_suggestion": {
            "summary": "string",
            "reasoning": "string",
            "waypoints": ["string"] // 1-2 intermediate locations to force a different route
          }
        }
      `;

      try {
        const aiResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            tools: [{ googleMaps: {} }],
            responseMimeType: "application/json",
          }
        });

        aiData = JSON.parse(aiResponse.text || "{}");
      } catch (aiError) {
        console.error("Gemini API Error:", aiError);
        aiData = {
          planB_analysis: {
            congestion_delta: "Error",
            capacity_evaluation: "AI analysis failed. See server logs.",
            time_to_failure: "Unknown",
            is_trap: true
          },
          planC_suggestion: {
            summary: "Fallback Alternative Route",
            reasoning: "Generated without AI due to API error.",
            waypoints: []
          }
        };
      }
    }

    // 3. Autonomous Pathfinding (The Escape)
    // Use the waypoints suggested by Gemini to generate Plan C via Google Maps API
    let planC = null;
    if (aiData.planC_suggestion && aiData.planC_suggestion.waypoints && aiData.planC_suggestion.waypoints.length > 0) {
      try {
        const planCResponse = await mapsClient.directions({
          params: {
            origin,
            destination,
            waypoints: aiData.planC_suggestion.waypoints,
            optimize: true,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
        });
        if (planCResponse.data.routes && planCResponse.data.routes.length > 0) {
          planC = planCResponse.data.routes[0];
        }
      } catch (e) {
        console.error("Error fetching Plan C:", e);
      }
    }

    // If Plan C generation failed, just use Plan B or modify it slightly
    if (!planC) {
      planC = planB;
    }

    res.json({
      planA: {
        summary: planA.summary,
        duration: planA.legs[0].duration.text,
        distance: planA.legs[0].distance.text,
        polyline: planA.overview_polyline.points,
        bounds: planA.bounds,
      },
      planB: {
        summary: planB.summary,
        duration: planB.legs[0].duration.text,
        distance: planB.legs[0].distance.text,
        polyline: planB.overview_polyline.points,
      },
      planC: {
        summary: aiData.planC_suggestion?.summary || "Alternative Route",
        duration: planC.legs[0].duration.text,
        distance: planC.legs[0].distance.text,
        polyline: planC.overview_polyline.points,
      },
      analysis: aiData.planB_analysis,
    });

  } catch (error) {
    console.error("Error processing routes:", error);
    res.status(500).json({ error: "Failed to process routes" });
  }
});

async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
