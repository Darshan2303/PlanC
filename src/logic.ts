/**
 * Polyline decoding utility
 */
export function decodePolyline(encoded: string) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

/**
 * Extracts JSON from a string that might contain markdown code blocks
 */
export function parseGeminiJson(text: string) {
  if (!text) return null;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", e);
    return null;
  }
}

/**
 * Fallback route data generator
 */
export function getFallbackRouteData(errorMessage: string) {
  return {
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
