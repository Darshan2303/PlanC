import { describe, it, expect } from 'vitest';
import { decodePolyline, parseGeminiJson, getFallbackRouteData } from './logic';

describe('decodePolyline', () => {
  it('should decode a simple polyline', () => {
    // Example from Google documentation: _p~iF~ps|U_ulLnnqC_mqNvxq`@
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const points = decodePolyline(encoded);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toHaveProperty('lat');
    expect(points[0]).toHaveProperty('lng');
  });

  it('should return empty array for empty input', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('parseGeminiJson', () => {
  it('should parse valid JSON', () => {
    const text = '{"foo": "bar"}';
    expect(parseGeminiJson(text)).toEqual({ foo: 'bar' });
  });

  it('should extract and parse JSON from markdown code blocks', () => {
    const text = 'Here is the result:\n```json\n{"foo": "bar"}\n```\nHope this helps!';
    expect(parseGeminiJson(text)).toEqual({ foo: 'bar' });
  });

  it('should return null for invalid JSON', () => {
    const text = 'not json';
    expect(parseGeminiJson(text)).toBeNull();
  });
});

describe('getFallbackRouteData', () => {
  it('should return structured fallback data', () => {
    const error = 'Test error';
    const data = getFallbackRouteData(error);
    expect(data.planB_analysis.capacity_evaluation).toContain(error);
    expect(data.planC_suggestion.waypoints).toEqual([]);
  });
});
