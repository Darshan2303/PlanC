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
    const mapsKey = req.headers['x-maps-key'] as string;
    const geminiKey = req.headers['x-gemini-key'] as string;
    const userRisk = req.headers['x-user-risk'] as string || 'agentic';
    const userAvoidance = req.headers['x-user-avoidance'] as string || '[]';
    
    const effectiveMapsKey = mapsKey || process.env.GOOGLE_MAPS_API_KEY;
    const effectiveGeminiKey = geminiKey || process.env.GEMINI_API_KEY;

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

    if (!effectiveMapsKey || effectiveMapsKey === "YOUR_GOOGLE_MAPS_API_KEY") {
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
          key: effectiveMapsKey,
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
    const planB = routes.length > 1 ? routes[1] : routes[0];

    // Extract road names to give Gemini spatial context for the routing decision
    const getRoads = (route: any) => {
      const roads = new Set<string>();
      route.legs[0].steps.forEach((s: any) => {
        const matches = s.html_instructions.match(/<b>(.*?)<\/b>/g);
        if (matches) {
          matches.forEach((m: string) => {
            const road = m.replace(/<\/?b>/g, '');
            if (road.length > 3 && !road.includes('Head') && !road.includes('Turn') && !road.includes('Merge')) {
              roads.add(road);
            }
          });
        }
      });
      return Array.from(roads);
    };

    const roadsA = getRoads(planA);
    const roadsB = getRoads(planB);

    // 2. Agentic Reasoning (The Meta-Predictor)
    let aiData: any = {};
    
    if (!effectiveGeminiKey || effectiveGeminiKey === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is missing or invalid. Using fallback reasoning.");
      // Fallback reasoning if Gemini API key is missing or invalid
      aiData = {
        planB_analysis: {
          congestion_delta: "+14 mins",
          capacity_evaluation: "Plan B capacity threshold exceeded (Predictive). AI Analysis Offline.",
          time_to_failure: "08:42.15",
          is_trap: true
        },
        planC_suggestion: {
          summary: "Agentic Bypass via Secondary Arterials",
          reasoning: "Fallback logic: Identifying low-overlap secondary paths.",
          waypoints: []
        }
      };
    } else {
      const userAi = new GoogleGenAI({ apiKey: effectiveGeminiKey });
      const prompt = `
        STRATEGIC ROUTING ANALYSIS: ${origin} to ${destination}
        
        USER PROFILE:
        Risk Tolerance: ${userRisk}
        Avoidance Preferences: ${userAvoidance}
        
        PLAN A (Primary): ${planA.summary}
        Major Roads: ${roadsA.join(', ')}
        
        PLAN B (Algorithmic Herd Alternative): ${planB.summary}
        Major Roads: ${roadsB.join(', ')}
        
        SITUATION: 
        Plan A is compromised by a major incident. 
        Standard navigation apps are currently funneling 85% of traffic onto Plan B.
        Plan B is a "Herd Trap" - it lacks the capacity for this surge.
        
        TASK:
        1. Analyze the spatial overlap between A and B.
        2. Evaluate the "Systemic Fragility" of Plan B.
        3. DECIDE on a "Plan C" (The Escape). This must be a mathematically isolated route.
        4. PERSONALIZE the decision: If risk is "conservative", prioritize safety/main roads. If "agentic", prioritize extreme isolation/secondary roads. Respect avoidance preferences: ${userAvoidance}.
        5. Provide 1-2 specific waypoints (neighborhoods, landmarks, or secondary roads) that will FORCE a route entirely different from A and B.
        
        RESPONSE FORMAT (JSON):
        {
          "planB_analysis": {
            "congestion_delta": "string (e.g. +22 mins)",
            "capacity_evaluation": "string (technical assessment)",
            "time_to_failure": "string (MM:SS.ms)",
            "is_trap": true
          },
          "planC_suggestion": {
            "summary": "string (Strategic name for the route)",
            "reasoning": "string (Why this bypass works spatially)",
            "waypoints": ["string"] 
          }
        }
      `;

      try {
        // Use recommended model from skill
        const result = await userAi.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const text = result.text;

        if (!text) throw new Error("Empty response from Gemini API");

        // Clean up markdown code blocks if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        aiData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch (aiError: any) {
        console.error("Gemini API Error:", aiError);
        
        // Check for specific API key errors
        let errorMessage = aiError.message || "Unknown error";
        if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("invalid api key")) {
          errorMessage = "Invalid Gemini API Key. Please check your settings.";
        } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
          errorMessage = "Gemini API quota exceeded. Try again in a minute.";
        }

        aiData = {
          planB_analysis: {
            congestion_delta: "Error",
            capacity_evaluation: `AI analysis failed: ${errorMessage}`,
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
            key: effectiveMapsKey,
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

    const mapSteps = (steps: any[]) => steps ? steps.map((s: any) => ({
      instruction: s.html_instructions,
      distance: s.distance?.text || '',
      duration: s.duration?.text || ''
    })) : [];

    res.json({
      planA: {
        summary: planA.summary,
        duration: planA.legs[0].duration.text,
        distance: planA.legs[0].distance.text,
        polyline: planA.overview_polyline.points,
        bounds: planA.bounds,
        steps: mapSteps(planA.legs[0].steps),
      },
      planB: {
        summary: planB.summary,
        duration: planB.legs[0].duration.text,
        distance: planB.legs[0].distance.text,
        polyline: planB.overview_polyline.points,
        steps: mapSteps(planB.legs[0].steps),
      },
      planC: {
        summary: aiData.planC_suggestion?.summary || "Alternative Route",
        reasoning: aiData.planC_suggestion?.reasoning,
        duration: planC.legs[0].duration.text,
        distance: planC.legs[0].distance.text,
        polyline: planC.overview_polyline.points,
        steps: mapSteps(planC.legs[0].steps),
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
