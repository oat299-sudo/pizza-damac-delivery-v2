import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, AlertTriangle, CheckCircle2, Info, RefreshCw, HelpCircle, Truck, Info as InfoIcon, X } from 'lucide-react';
import { calculateDistanceKm, reverseGeocode } from '../../utils/geo';
import { getLalamoveQuote, LalamoveQuote } from '../../services/lalamoveService';
import { RESTAURANT_LOCATION } from '../../constants';

interface DeliveryMapProps {
  lat: number;
  lng: number;
  storeLat?: number;
  storeLng?: number;
  onChange: (lat: number, lng: number, distanceKm: number, addressName: string) => void;
  language: 'en' | 'th';
}

// Popular Bangkok/Nonthaburi landmarks for Mock Map selector
const MOCK_DESTINATIONS = [
  { name: 'Siam Paragon (สยามพารากอน)', lat: 13.7461, lng: 100.5341, distance: 20.3 },
  { name: 'Central Westgate (เซ็นทรัล เวสต์เกต)', lat: 13.8756, lng: 100.4109, distance: 13.2 },
  { name: 'Impact Arena Muang Thong Thani (อิมแพ็ค เมืองทองธานี)', lat: 13.9114, lng: 100.5501, distance: 3.5 },
  { name: 'Don Mueang Airport (สนามบินดอนเมือง)', lat: 13.9133, lng: 100.6042, distance: 9.1 },
  { name: 'Central Chaengwattana (เซ็นทรัล แจ้งวัฒนะ)', lat: 13.9038, lng: 100.5284, distance: 2.3 }
];

export default function DeliveryMap({ lat, lng, storeLat = RESTAURANT_LOCATION.lat, storeLng = RESTAURANT_LOCATION.lng, onChange, language }: DeliveryMapProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [localQuotes, setLocalQuotes] = useState<LalamoveQuote[]>([]);
  const [estimatedDistance, setEstimatedDistance] = useState<number>(0);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  
  const initialKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
  const [apiKey, setApiKey] = useState<string>(initialKey);
  const [hasValidKey, setHasValidKey] = useState<boolean>(Boolean(initialKey) && initialKey.length > 5 && initialKey !== 'YOUR_API_KEY');

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const key = data.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
        setApiKey(key);
        setHasValidKey(Boolean(key) && key.length > 5 && key !== 'YOUR_API_KEY');
      })
      .catch(err => console.error("Failed to load config:", err));
  }, []);

  // Sync internal quotes whenever lat/lng changes
  useEffect(() => {
    const dist = calculateDistanceKm(storeLat, storeLng, lat, lng);
    setEstimatedDistance(dist);
    const quotes = getLalamoveQuote(dist);
    setLocalQuotes(quotes);

    // Fetch address text
    reverseGeocode(lat, lng).then(addr => {
      if (addr) {
        setResolvedAddress(addr);
      }
    });
  }, [lat, lng]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(language === 'th' ? 'เบราว์เซอร์ของคุณไม่รองรับ GPS' : 'Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const dist = calculateDistanceKm(storeLat, storeLng, userLat, userLng);
        
        reverseGeocode(userLat, userLng).then(addr => {
          const addrName = addr || `GPS Pin: ${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
          onChange(userLat, userLng, dist, addrName);
          setGpsLoading(false);
        });
      },
      (err) => {
        console.error(err);
        alert(language === 'th' ? 'ไม่สามารถระบุตำแหน่ง GPS ของคุณได้ กรุณาใส่ที่อยู่ทางแผนที่' : 'Failed to retrieve your GPS location.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSelectMockDestination = (dest: typeof MOCK_DESTINATIONS[0]) => {
    setSearchTerm(dest.name);
    onChange(dest.lat, dest.lng, dest.distance, dest.name);
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    if (!place.geometry || !place.geometry.location) return;
    const placeLat = place.geometry.location.lat();
    const placeLng = place.geometry.location.lng();
    const addressName = place.formatted_address || place.name || '';
    const dist = calculateDistanceKm(storeLat, storeLng, placeLat, placeLng);
    onChange(placeLat, placeLng, dist, addressName);
  };

  return (
    <div className="space-y-4 border border-brand-100 rounded-xl bg-white p-4 shadow-sm" id="delivery-map-container">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <MapPin size={16} className="text-brand-600 animate-bounce" />
          {language === 'th' ? 'เลือกตำแหน่งพิกัดจัดส่ง' : 'Pin Delivery Destination'}
        </h4>
        <button
          type="button"
          onClick={() => setShowKeyHelp(!showKeyHelp)}
          className="hidden text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-semibold"
        >
          <HelpCircle size={14} />
          {language === 'th' ? 'คู่มือแผนที่กูเกิล' : 'Google Map Setup'}
        </button>
      </div>

      {/* Google Map Key Setup Help Box */}
      {false && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-xs leading-relaxed text-amber-800 animate-fade-in space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertTriangle size={15} className="text-amber-600" />
            <span>{language === 'th' ? 'ระบบต้องการ Google Maps API Key สำหรับฟังก์ชันค้นหาเสมือนจริง' : 'Google Maps API Key Required for Live Map Pinning'}</span>
          </div>
          <p className="text-sm text-amber-700">
            {language === 'th' 
              ? 'คุณยังไม่ได้เปิดใช้ Google Maps API Key หรือยังไม่ได้กำหนดในระบบ Secrets เพื่อให้แผนที่ Google Maps จริงทำงาน กรุณาเพิ่มคีย์ตามขั้นตอนดังนี้:'
              : 'The real-time Google Maps widget and Place Autocomplete require a valid Google Maps Platform Key to load. Follow these steps:'}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-sm text-amber-800 font-medium">
            <li>
              <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener" className="underline text-blue-600 font-bold">
                {language === 'th' ? 'คลิกที่นี่เพื่อรับ API Key ฟรี' : 'Get a Google Maps API Key'}
              </a>
            </li>
            <li>
              {language === 'th' 
                ? 'เปิดปุ่มตั้งค่า (⚙️ ฟันเฟืองขวาบน) -> Secrets' 
                : 'Open Settings (⚙️ gear icon, top-right) -> Secrets'}
            </li>
            <li>
              {language === 'th' 
                ? 'เพิ่มตัวแปรชื่อ GOOGLE_MAPS_PLATFORM_KEY แล้ววางคีย์ที่ได้ลงไป แล้วกด Enter' 
                : 'Create a secret named GOOGLE_MAPS_PLATFORM_KEY and paste your key.'}
            </li>
          </ol>
          <p className="text-sm text-amber-600 font-semibold bg-white/60 p-1.5 rounded border border-amber-200/50">
            {language === 'th'
              ? '💡 ตอนนี้ระบบเปิดใช้งาน โหมดสาธิตแบบจำลองแผนที่ (Mock Map Sandbox) ให้คุณทดสอบการส่งพิกัดและคำนวณค่าส่ง Lalamove ได้ทันที!'
              : '💡 Sandbox Mode is active! You can pick simulation landmarks or drop mock pins to calculate estimated Lalamove rates now.'}
          </p>
        </div>
      )}

      {/* MAP AND ROUTE BLOCK */}
      <div className="relative">
        {hasValidKey ? (
          // REAL GOOGLE MAP WITH PLACES AUTOCOMPLETE
          <APIProvider apiKey={apiKey} version="weekly">
            <div className="space-y-3">
              <PlacesAutocomplete 
                language={language}
                onPlaceSelect={handlePlaceSelect}
              />
              <div className="w-full h-[350px] rounded-xl overflow-hidden border border-gray-200 relative bg-gray-50">
                <MapInstance 
                  lat={lat} 
                  lng={lng} 
                  storeLat={storeLat}
                  storeLng={storeLng}
                  onChange={onChange} 
                  language={language} 
                  estimatedDistance={estimatedDistance}
                  resolvedAddress={resolvedAddress}
                />
              </div>
            </div>
          </APIProvider>
        ) : (
          <div className="w-full flex flex-col gap-2">
            <div className="w-full rounded-xl border border-gray-200 overflow-hidden relative h-[250px] md:h-[350px]">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={`https://maps.google.com/maps?q=${lat},${lng}&hl=${language === 'th' ? 'th' : 'en'}&z=14&output=embed`}
              ></iframe>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
              <p className="text-xs font-extrabold text-gray-500 uppercase mb-2">{language === 'th' ? 'จำลองสถานที่จัดส่ง (ไม่มี API Key)' : 'Mock Locations (No API Key)'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                {MOCK_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => handleSelectMockDestination(dest)}
                    className="p-2 rounded bg-white border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 text-left text-xs font-semibold text-gray-700 truncate shadow-sm transition"
                  >
                    📍 {dest.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Geolocation Button */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={gpsLoading}
          className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition flex items-center justify-center gap-1.5"
        >
          {gpsLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Navigation size={14} />
          )}
          {language === 'th' ? 'ดึงพิกัดปัจจุบัน (Use GPS)' : 'Fetch My GPS Location'}
        </button>
      </div>

      {/* LALAMOVE RATE ESTIMATIONS TABLE */}
      {estimatedDistance > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5 animate-fade-in">
          <div className="flex justify-between items-center border-b border-gray-200/80 pb-1.5">
            <span className="text-sm font-extrabold text-orange-600 flex items-center gap-1 uppercase">
              <Truck size={14} />
              {language === 'th' ? 'ประมาณการค่าส่งลาร่ามูฟ (Lalamove Estimations)' : 'Lalamove Delivery Quotes'}
            </span>
            <span className="text-sm text-gray-400 font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded">
              {estimatedDistance.toFixed(2)} km
            </span>
          </div>

          <div className="space-y-1.5">
            {localQuotes.map((quote) => (
              <div 
                key={quote.vehicleType} 
                className="flex items-center justify-between p-2 rounded-md bg-white border border-gray-200/60 hover:border-orange-200 transition shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {quote.vehicleType === 'motorcycle' ? '🛵' : quote.vehicleType === 'car' ? '🚗' : '🚚'}
                  </span>
                  <div>
                    <div className="text-sm font-extrabold text-gray-800">
                      {language === 'th' ? quote.vehicleNameTh : quote.vehicleName}
                    </div>
                    <div className="text-xs text-gray-400 font-semibold">
                      {language === 'th' ? `ระยะเวลาประมาณ ${quote.etaMinutes} นาที` : `ETA: ~${quote.etaMinutes} mins`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-extrabold text-orange-600">
                    ฿{quote.totalFare}
                  </div>
                  <div className="text-xs text-gray-400 font-semibold">
                    {language === 'th' ? `เริ่มต้น ฿${quote.baseFare}` : `Base ฿${quote.baseFare}`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 leading-normal bg-orange-50/50 p-2 rounded border border-orange-100/30 flex items-start gap-1">
            <InfoIcon size={10} className="shrink-0 mt-0.5 text-orange-400" />
            <span>
              {language === 'th'
                ? '*นี่คือค่าส่งประเมินทางกูเกิลแมพ และประเมินอัตราลาร่ามูฟ มอเตอร์ไซค์, รถยนต์ และ กระบะตามระยะทางจริงในกรุงเทพและปริมณฑล ทางร้านจะเรียกและยืนยันค่าบริการใน POS อีกครั้ง'
                : '*Estimated delivery fees modeled exactly on Lalamove official Bangkok tariff. Actual quotes verified and booked by staff in POS dispatch center.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component to handle internal Vis.gl Google Map logic to prevent load-time dependency errors
function MapInstance({ 
  lat, 
  lng, 
  storeLat = RESTAURANT_LOCATION.lat, 
  storeLng = RESTAURANT_LOCATION.lng, 
  onChange, 
  language, 
  estimatedDistance, 
  resolvedAddress 
}: DeliveryMapProps & { estimatedDistance: number, resolvedAddress: string }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Draw Route Polyline from Store to Customer Pin
  useEffect(() => {
    if (!routesLib || !map) return;

    // Clear previous polylines
    polylinesRef.current.forEach(p => p.setMap(null));

    const origin = { lat: storeLat, lng: storeLng };
    const destination = { lat, lng };

    routesLib.Route.computeRoutes({
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
    .then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(p => p.setMap(map));
        polylinesRef.current = newPolylines;

        // Auto pan viewport to frame both store and user delivery pin
        if (routes[0].viewport) {
          map.fitBounds(routes[0].viewport);
        }
      }
    })
    .catch((err) => {
      console.error("Route computing failed:", err);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [routesLib, map, lat, lng, storeLat, storeLng]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const clickLat = e.latLng.lat();
      const clickLng = e.latLng.lng();
      const dist = calculateDistanceKm(storeLat, storeLng, clickLat, clickLng);
      
      reverseGeocode(clickLat, clickLng).then(addr => {
        onChange(clickLat, clickLng, dist, addr || `Coordinate Pin: ${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`);
      });
    }
  };

  return (
    <Map
      defaultCenter={{ lat, lng }}
      defaultZoom={13}
      mapId="DEMO_MAP_ID"
      onClick={handleMapClick}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Pizza Store Location Marker */}
      <AdvancedMarker position={{ lat: storeLat, lng: storeLng }} title="Pizza Damac (Store)">
        <Pin background="#ea580c" glyphColor="#fff" borderColor="#c2410c" scale={1.2}>🍕</Pin>
      </AdvancedMarker>

      {/* Customer Delivery Pin */}
      <AdvancedMarker 
        position={{ lat, lng }} 
        gmpDraggable={true} 
        onDragEnd={(e) => {
          if (e.latLng) {
            const dragLat = e.latLng.lat();
            const dragLng = e.latLng.lng();
            const dist = calculateDistanceKm(storeLat, storeLng, dragLat, dragLng);
            reverseGeocode(dragLat, dragLng).then(addr => {
              onChange(dragLat, dragLng, dist, addr || `Dragged Pin: ${dragLat.toFixed(5)}, ${dragLng.toFixed(5)}`);
            });
          }
        }}
        title="Delivery Destination"
      />
    </Map>
  );
}

interface PlacesAutocompleteProps {
  language: 'en' | 'th';
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
}

function PlacesAutocomplete({ language, onPlaceSelect }: PlacesAutocompleteProps) {
  const [hasValue, setHasValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    // Restrict predictions to Thailand for relevance
    const options: google.maps.places.AutocompleteOptions = {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'th' }
    };

    const autocomplete = new placesLib.Autocomplete(inputRef.current, options);

    // Prevent form submission on press Enter
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    };
    
    const handleInput = () => {
      setHasValue(!!inputRef.current?.value);
    };

    const inputEl = inputRef.current;
    inputEl.addEventListener('keydown', handleKeyDown);
    inputEl.addEventListener('input', handleInput);

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place && place.geometry) {
        onPlaceSelect(place);
      }
    });

    return () => {
      inputEl.removeEventListener('keydown', handleKeyDown);
      inputEl.removeEventListener('input', handleInput);
      google.maps.event.removeListener(listener);
    };
  }, [placesLib, onPlaceSelect]);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      setHasValue(false);
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative w-full z-10">
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={16} />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="w-full border border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl pl-10 pr-10 py-2.5 text-xs outline-none transition font-medium shadow-sm bg-white"
          placeholder={language === 'th' ? 'พิมพ์ค้นหาที่อยู่จัดส่งของคุณ (ชื่อหมู่บ้าน/ซอย/ถนน)...' : 'Search delivery address, condo, street...'}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition animate-fade-in"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

