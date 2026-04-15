/// <reference types="vite/client" />
import React, { Component, useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Polyline, Marker, TrafficLayer, InfoWindow } from '@react-google-maps/api';
import { MapPin, Flag, AlertTriangle, Loader2, Info, Settings, X, ChevronDown, ChevronUp, Database, History, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { decodePolyline } from './logic';

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
// Moved to logic.ts

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Use a stable key from environment variable
  const committedMapsKey = useRef(import.meta.env.VITE_GOOGLE_MAPS_API_KEY).current;
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: committedMapsKey || '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [origin, setOrigin] = useState('Whitefield, Bangalore');
  const [destination, setDestination] = useState('Indiranagar, Bangalore');
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [error, setError] = useState('');
  const [hoverInfo, setHoverInfo] = useState<{ position: google.maps.LatLng, title: string, duration: string, color: string } | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<'A' | 'B' | 'C' | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'aggressive' | 'agentic'>('agentic');
  const [avoidance, setAvoidance] = useState<string[]>([]);
  const [history, setHistory] = useState<{origin: string, destination: string}[]>([]);

  useEffect(() => {
    const savedRisk = localStorage.getItem('user_risk_tolerance');
    const savedAvoidance = localStorage.getItem('user_avoidance');
    const savedHistory = localStorage.getItem('user_history');
    if (savedRisk) setRiskTolerance(savedRisk as any);
    if (savedAvoidance) setAvoidance(JSON.parse(savedAvoidance));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const saveSettings = () => {
    localStorage.setItem('user_risk_tolerance', riskTolerance);
    localStorage.setItem('user_avoidance', JSON.stringify(avoidance));
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
          'X-User-Risk': riskTolerance,
          'X-User-Avoidance': JSON.stringify(avoidance)
        },
        body: JSON.stringify({ 
          origin, 
          destination
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch routes');
      }

      setRouteData(data);
      
      // Update History
      const newHistory = [{origin, destination}, ...history.filter(h => h.origin !== origin || h.destination !== destination)].slice(0, 3);
      setHistory(newHistory);
      localStorage.setItem('user_history', JSON.stringify(newHistory));

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

  const loadTestData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/test-data.json');
      const data = await response.json();
      setRouteData(data);
      if (map && data.planA?.bounds) {
        const bounds = new window.google.maps.LatLngBounds(
          data.planA.bounds.southwest,
          data.planA.bounds.northeast
        );
        map.fitBounds(bounds);
      }
    } catch (err: any) {
      setError("Failed to load test data. Ensure test-data.json exists in the public folder.");
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
      <div 
        className="relative flex-1 border-r border-[var(--color-muted)] overflow-hidden bg-[radial-gradient(circle_at_center,#1A1A22_0%,#0A0A0B_100%)]"
        role="region"
        aria-label="Interactive Traffic Map"
      >
        <div className="absolute inset-0 map-grid z-0 pointer-events-none"></div>
        
        {/* Settings & Demo Buttons */}
        <div className="absolute top-6 right-6 z-30 flex gap-2">
          <button 
            onClick={loadTestData}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-muted)] rounded text-xs text-[var(--color-text-dim)] hover:text-white transition-colors"
            title="Load Test Data"
            aria-label="Load demonstration data"
          >
            <Database className="w-4 h-4" />
            <span>Demo Data</span>
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-[var(--color-surface)] border border-[var(--color-muted)] rounded text-[var(--color-text-dim)] hover:text-white transition-colors"
            aria-label="Open system configuration"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

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
                  <div className="border-t border-white/10 pt-6">
                    <label className="block text-xs uppercase tracking-widest text-[var(--color-text-dim)] mb-4">Risk Tolerance Profile</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['conservative', 'aggressive', 'agentic'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setRiskTolerance(level)}
                          className={`py-2 text-[10px] uppercase tracking-wider border rounded transition-all ${
                            riskTolerance === level 
                              ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-bg)] font-bold' 
                              : 'border-[var(--color-muted)] text-[var(--color-text-dim)] hover:border-white'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[var(--color-text-dim)] mb-4">Avoidance Preferences</label>
                    <div className="flex flex-wrap gap-2">
                      {['Tolls', 'Highways', 'Ferries', 'Residential'].map((item) => (
                        <button
                          key={item}
                          onClick={() => setAvoidance(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])}
                          className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border rounded-full transition-all ${
                            avoidance.includes(item)
                              ? 'bg-white text-black border-white font-bold'
                              : 'border-[var(--color-muted)] text-[var(--color-text-dim)] hover:border-white'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-[var(--color-text-dim)] leading-relaxed italic">
                    Note: If you are having trouble pasting, try using the keyboard shortcut (Ctrl+V or Cmd+V) while the field is focused.
                  </p>

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
          {!committedMapsKey ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center">
              <AlertTriangle className="w-12 h-12 text-[var(--color-danger)] mb-4" />
              <h3 className="text-xl font-bold mb-2">Google Maps API Key Missing</h3>
              <p className="text-[var(--color-text-dim)] max-w-md">
                Please add your API key via the settings icon in the top-right corner.
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
          {/* User Profile & Personalization */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-bg)] font-bold text-xs">
                U
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest">Personalized For</div>
                <div className="text-xs font-medium truncate max-w-[120px]">Guest User</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter ${riskTolerance === 'agentic' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {riskTolerance}
              </div>
              <div className="text-[8px] text-[var(--color-text-dim)] mt-1">
                {avoidance.length > 0 ? `${avoidance.length} Avoidances` : 'No Avoidances'}
              </div>
            </div>
          </div>

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
              <label htmlFor="origin-input" className="sr-only">Start Location</label>
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-accent)]" />
              <input 
                id="origin-input"
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Start location"
                className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white placeholder-[var(--color-text-dim)]"
              />
            </div>
            <div className="relative">
              <label htmlFor="destination-input" className="sr-only">Destination</label>
              <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
              <input 
                id="destination-input"
                type="text" 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination"
                className="w-full bg-white/5 border border-[var(--color-muted)] rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[var(--color-accent)] outline-none transition-all text-white placeholder-[var(--color-text-dim)]"
              />
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-500 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </div>

          {/* Search History */}
          {history.length > 0 && (
            <div className="mb-8">
              <div className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-widest mb-3 flex items-center gap-2">
                <History className="w-3 h-3" />
                <span>Recent Extractions</span>
              </div>
              <div className="space-y-2">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setOrigin(item.origin);
                      setDestination(item.destination);
                    }}
                    className="w-full text-left p-2 bg-white/5 border border-white/5 hover:border-white/20 rounded transition-all group"
                  >
                    <div className="text-[10px] text-white/80 truncate group-hover:text-[var(--color-accent)] transition-colors">
                      {item.origin} → {item.destination}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                      {routeData.planC.reasoning || "Generated mathematically isolated route with 0% polyline overlap."}
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

                {/* Personalized Insights */}
                <div className="mb-8 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-[var(--color-accent)]" />
                    <span className="text-[11px] uppercase font-bold tracking-widest text-[var(--color-accent)]">Personalized Insight</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-dim)] leading-relaxed italic">
                    {riskTolerance === 'agentic' 
                      ? "Your 'Agentic' profile is currently overriding standard navigation logic to prioritize extreme spatial isolation. We are scanning for secondary arterials that the 'Herd' algorithms are ignoring."
                      : riskTolerance === 'conservative'
                      ? "Your 'Conservative' profile is prioritizing established secondary roads with high visibility and emergency access, while still avoiding the Plan B herd trap."
                      : "Your 'Aggressive' profile is balancing speed and isolation, looking for the fastest possible bypass regardless of road class."}
                  </p>
                </div>

                {/* Route Details Collapsible Panel */}
                <div className="border-t border-white/10 pt-6 mb-8">
                  <span className="text-[11px] uppercase text-[var(--color-text-dim)] tracking-[2px] mb-3 block">Route Details</span>
                  
                  {['A', 'B', 'C'].map((planKey) => {
                    const planData = routeData[`plan${planKey}`];
                    if (!planData || !planData.steps) return null;
                    
                    const isExpanded = expandedRoute === planKey;
                    const colorMap: Record<string, string> = {
                      'A': '#FF3366',
                      'B': '#FFCC00',
                      'C': '#00FF88'
                    };
                    const titleMap: Record<string, string> = {
                      'A': 'Plan A (Primary)',
                      'B': 'Plan B (Herd)',
                      'C': 'Plan C (Escape)'
                    };

                    return (
                      <div key={planKey} className="mb-2">
                        <button 
                          onClick={() => setExpandedRoute(isExpanded ? null : planKey as 'A' | 'B' | 'C')}
                          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap[planKey] }}></div>
                            <span className="text-sm font-medium">{titleMap[planKey]}</span>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-text-dim)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-dim)]" />}
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 bg-black/20 rounded-b text-xs text-gray-300 max-h-64 overflow-y-auto custom-scrollbar">
                                {planData.steps.map((step: any, i: number) => (
                                  <div key={i} className="mb-3 pb-3 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
                                    <div className="leading-relaxed">
                                     {step.instruction.replace(/<[^>]*>?/gm, '')}
                                   </div>
                                    <div className="text-[10px] text-[var(--color-text-dim)] mt-1.5 font-mono">
                                      {step.distance} • {step.duration}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
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
          aria-label={loading ? "Processing route" : (routeData ? "Recalculate route protocol" : "Initiate Plan C route protocol")}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (routeData ? 'Recalculate Protocol' : 'Initiate Plan C Protocol')}
        </button>
      </aside>
    </div>
  );
}
