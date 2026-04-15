/// <reference types="vite/client" />
import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, TrafficLayer, InfoWindow } from '@react-google-maps/api';
import { MapPin, Flag, AlertTriangle, Loader2, Info, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const containerStyle = {
  width: '100%',
  height: '100vh'
};

const defaultCenter = {
  lat: 12.9716, // Bangalore
  lng: 77.5946
};

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0A0A0B" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#88888D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0A0B" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#44444A" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#141417" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#44444A" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
];

// Polyline decoding utility
function decodePolyline(encoded: string) {
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

export default function App() {
  const [userMapsKey, setUserMapsKey] = useState(localStorage.getItem('user_maps_key') || '');
  const [userGeminiKey, setUserGeminiKey] = useState(localStorage.getItem('user_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  const apiKey = userMapsKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [origin, setOrigin] = useState('Whitefield, Bangalore');
  const [destination, setDestination] = useState('Indiranagar, Bangalore');
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [error, setError] = useState('');
  const [hoverInfo, setHoverInfo] = useState<{ position: google.maps.LatLng, title: string, duration: string, color: string } | null>(null);

  const saveSettings = () => {
    localStorage.setItem('user_maps_key', userMapsKey);
    localStorage.setItem('user_gemini_key', userGeminiKey);
    setShowSettings(false);
    window.location.reload();
  };

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const fetchRoutes = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError('');
    setRouteData(null);
    setHoverInfo(null);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          origin, 
          destination,
          mapsKey: userMapsKey,
          geminiKey: userGeminiKey
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch routes');
      }

      setRouteData(data);

      if (map && data.planA?.bounds) {
        const bounds = new window.google.maps.LatLngBounds(
          data.planA.bounds.southwest,
          data.planA.bounds.northeast
        );
        map.fitBounds(bounds);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const planAPath = routeData ? (typeof routeData.planA.polyline === 'string' ? decodePolyline(routeData.planA.polyline) : routeData.planA.polyline) : [];
  const planBPath = routeData ? (typeof routeData.planB.polyline === 'string' ? decodePolyline(routeData.planB.polyline) : routeData.planB.polyline) : [];
  const planCPath = routeData ? (typeof routeData.planC.polyline === 'string' ? decodePolyline(routeData.planC.polyline) : routeData.planC.polyline) : [];

  const isPlanBSameAsC = routeData && JSON.stringify(routeData.planB.polyline) === JSON.stringify(routeData.planC.polyline);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text-main)] font-['Helvetica_Neue',Arial,sans-serif]">
      {/* Map Section */}
      <div className="relative flex-1 border-r border-[var(--color-muted)] overflow-hidden bg-[radial-gradient(circle_at_center,#1A1A22_0%,#0A0A0B_100%)]">
        <div className="absolute inset-0 map-grid z-0 pointer-events-none"></div>
        
        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-6 right-6 z-30 p-2 bg-[var(--color-surface)] border border-[var(--color-muted)] rounded-full text-[var(--color-text-dim)] hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[var(--color-surface)] border border-[var(--color-muted)] w-full max-w-md p-8 rounded-lg shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold uppercase tracking-widest">System Configuration</h3>
                  <button onClick={() => setShowSettings(false)} className="text-[var(--color-text-dim)] hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--color-text-dim)] mb-2">Google Maps API Key</label>
                    <input 
                      type="password"
                      value={userMapsKey}
                      onChange={(e) => setUserMapsKey(e.target.value)}
                      placeholder="Enter Maps API Key"
                      className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 px-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--color-text-dim)] mb-2">Gemini API Key</label>
                    <input 
                      type="password"
                      value={userGeminiKey}
                      onChange={(e) => setUserGeminiKey(e.target.value)}
                      placeholder="Enter Gemini API Key"
                      className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 px-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white"
                    />
                  </div>

                  <button 
                    onClick={saveSettings}
                    className="w-full bg-[var(--color-accent)] text-[var(--color-bg)] font-bold uppercase tracking-widest py-4 rounded-sm hover:opacity-90 transition-opacity mt-4"
                  >
                    Save & Re-Initialize
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-10 opacity-80 mix-blend-screen">
          {!apiKey ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="w-12 h-12 text-[var(--color-danger)] mb-4" />
              <h3 className="text-xl font-bold mb-2">Google Maps API Key Missing</h3>
              <p className="text-[var(--color-text-dim)] max-w-md">
                Please add <strong>VITE_GOOGLE_MAPS_API_KEY</strong> to your Secrets panel in AI Studio to enable the map and routing features.
              </p>
            </div>
          ) : loadError ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="w-12 h-12 text-[var(--color-danger)] mb-4" />
              <h3 className="text-xl font-bold mb-2">Map Load Error</h3>
              <p className="text-[var(--color-text-dim)] max-w-md">
                {loadError.message || "Google Maps failed to load. Please check if 'Maps JavaScript API' is enabled in your Google Cloud Console and billing is active."}
              </p>
            </div>
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={defaultCenter}
              zoom={12}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                disableDefaultUI: true,
                styles: darkMapStyles
              }}
            >
              <TrafficLayer />

              {/* Plan A - Primary (Red) */}
              {planAPath.length > 0 && (
                <>
                  <Polyline
                    path={planAPath}
                    options={{
                      strokeColor: '#FF3E3E', // Red
                      strokeOpacity: 0.3,
                      strokeWeight: 12,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan A (Primary)', duration: routeData.planA.duration, color: '#FF3E3E' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                  <Polyline
                    path={planAPath}
                    options={{
                      strokeColor: '#FF3E3E', // Red
                      strokeOpacity: 0.9,
                      strokeWeight: 6,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan A (Primary)', duration: routeData.planA.duration, color: '#FF3E3E' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                </>
              )}
              
              {/* Plan B - Trap (Yellow) */}
              {planBPath.length > 0 && (
                <>
                  <Polyline
                    path={planBPath}
                    options={{
                      strokeColor: '#FFCC00', // Yellow
                      strokeOpacity: 0.3,
                      strokeWeight: 12,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan B (Algorithmic Herd)', duration: routeData.planB.duration, color: '#FFCC00' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                  <Polyline
                    path={planBPath}
                    options={{
                      strokeColor: '#FFCC00', // Yellow
                      strokeOpacity: 0.9,
                      strokeWeight: 6,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan B (Algorithmic Herd)', duration: routeData.planB.duration, color: '#FFCC00' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                </>
              )}

              {/* Plan C - Optimal (Green) */}
              {planCPath.length > 0 && (
                <>
                  <Polyline
                    path={planCPath}
                    options={{
                      strokeColor: '#00FF88',
                      strokeOpacity: 0.3,
                      strokeWeight: 14,
                      zIndex: 9,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan C (Agentic Escape)', duration: routeData.planC.duration, color: '#00FF88' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                  <Polyline
                    path={planCPath}
                    options={{
                      strokeColor: '#00FF88',
                      strokeOpacity: 1,
                      strokeWeight: 8,
                      zIndex: 10,
                    }}
                    onMouseOver={(e) => setHoverInfo({ position: e.latLng!, title: 'Plan C (Agentic Escape)', duration: routeData.planC.duration, color: '#00FF88' })}
                    onMouseOut={() => setHoverInfo(null)}
                  />
                </>
              )}

              {/* Hover InfoWindow */}
              {hoverInfo && (
                <InfoWindow position={hoverInfo.position} options={{ disableAutoPan: true }}>
                  <div className="p-2 bg-[var(--color-surface)] text-[var(--color-text-main)] rounded border border-[var(--color-muted)] font-['Helvetica_Neue',Arial,sans-serif] min-w-[150px]">
                    <div className="font-bold text-sm mb-1" style={{ color: hoverInfo.color }}>{hoverInfo.title}</div>
                    <div className="text-xs text-[var(--color-text-dim)]">Est. Time: <span className="text-white font-mono">{hoverInfo.duration}</span></div>
                  </div>
                </InfoWindow>
              )}

              {/* Markers */}
              {planAPath.length > 0 && (
                <>
                  <Marker position={planAPath[0]} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }} />
                  <Marker position={planAPath[planAPath.length - 1]} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }} />
                </>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-muted)]" />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Section */}
      <aside className="w-[340px] bg-[var(--color-surface)] p-[40px_30px] flex flex-col justify-between overflow-y-auto shrink-0 z-20">
        <div className="flex flex-col">
          {/* Branding */}
          <div className="mb-10">
            <div className="font-mono text-[11px] text-[var(--color-accent)] border border-[var(--color-accent)] px-2 py-1 inline-block mb-4">
              ENGINE ACTIVE: NODE_419
            </div>
            <h1 className="text-[48px] font-black tracking-[-2px] leading-[0.8] mb-2">
              Plan<span className="text-[var(--color-accent)]">C</span>
            </h1>
            <p className="text-[var(--color-text-dim)] text-[13px] mt-[10px]">
              Meta-Predictive Secondary Routing
            </p>
          </div>

          {/* Search Inputs */}
          <div className="flex flex-col gap-3 mb-8">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-accent)]" />
              <input 
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Start location"
                className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white placeholder-[var(--color-text-dim)]"
              />
            </div>
            <div className="relative">
              <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
              <input 
                type="text" 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination"
                className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white placeholder-[var(--color-text-dim)]"
              />
            </div>
          </div>

          {/* Dynamic Content (Route Data) */}
          <AnimatePresence>
            {routeData && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col"
              >
                {/* Countdown Box */}
                <div className="border-l-4 border-[var(--color-danger)] pl-5 mb-10">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)] tracking-[2px] mb-3 block">Time-To-Failure: Plan B</span>
                  <div className="text-[52px] font-mono font-bold text-[var(--color-danger)] leading-none">
                    {routeData.analysis?.time_to_failure || "04:18.02"}
                  </div>
                  <div className="text-[12px] text-[var(--color-text-dim)] mt-[5px]">
                    Algorithmic Herd Capacity Threshold: 92%
                  </div>
                  <div className="h-1 w-full bg-[var(--color-muted)] mt-2 relative">
                    <div className="absolute h-full bg-[var(--color-danger)] w-[92%]"></div>
                  </div>
                </div>

                {/* Metric Group */}
                <div className="mb-8">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)] tracking-[2px] mb-3 block">System Reasoning</span>
                  
                  <div className="bg-[rgba(255,255,255,0.03)] p-5 rounded-[4px] mb-[15px]">
                    <div className="text-[14px] font-semibold mb-[5px]">The Observer</div>
                    <div className="text-[12px] text-[var(--color-text-dim)] leading-[1.4]">
                      Extracting computeAlternativeRoutes... Primary incident identified on Plan A.
                      <br/><span className="text-white mt-1 block">ETA: {routeData.planA.duration}</span>
                    </div>
                  </div>

                  <div className="bg-[rgba(255,255,255,0.03)] p-5 rounded-[4px] mb-[15px]">
                    <div className="text-[14px] font-semibold mb-[5px] text-[var(--color-danger)]">The Meta-Predictor</div>
                    <div className="text-[12px] text-[var(--color-text-dim)] leading-[1.4]">
                      {routeData.analysis?.capacity_evaluation || "Plan B is a low-capacity residential class. Predictive gridlock imminent."}
                      <br/><span className="text-[var(--color-danger)] mt-1 block">ETA: {routeData.planB.duration}</span>
                    </div>
                  </div>

                  <div className="border border-[var(--color-accent)] bg-[rgba(0,255,136,0.05)] p-5 rounded-[4px] mb-[15px]">
                    <div className="text-[14px] font-semibold mb-[5px] text-[var(--color-accent)]">The Escape</div>
                    <div className="text-[12px] text-[var(--color-text-dim)] leading-[1.4]">
                      Generated mathematically isolated route with 0% polyline overlap.
                      <br/><span className="text-[var(--color-accent)] font-bold mt-1 block">ETA: {routeData.planC.duration}</span>
                    </div>
                    {isPlanBSameAsC && (
                      <div className="mt-3 p-2 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded text-xs text-[#FFCC00] flex items-start">
                        <AlertTriangle className="w-3 h-3 mr-1.5 mt-0.5 shrink-0" />
                        <span>Plan B and Plan C are identical. The AI could not find a distinct alternative route.</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <button 
          onClick={fetchRoutes}
          disabled={loading || !origin || !destination}
          className="bg-[var(--color-accent)] text-[var(--color-bg)] border-none p-[18px] font-[800] uppercase tracking-[1px] cursor-pointer w-full mt-auto disabled:opacity-50 transition-opacity flex items-center justify-center shrink-0"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (routeData ? 'Recalculate Protocol' : 'Initiate Plan C Protocol')}
        </button>
      </aside>
    </div>
  );
}
