import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { calculateDistanceKm, reverseGeocode } from '../../utils/geo';
import { RESTAURANT_LOCATION } from '../../constants';

interface DeliveryMapProps {
  lat: number;
  lng: number;
  storeLat?: number;
  storeLng?: number;
  onChange: (lat: number, lng: number, distanceKm: number, addressName: string) => void;
  language: 'en' | 'th';
}

export default function DeliveryMap({ lat, lng, storeLat = RESTAURANT_LOCATION.lat, storeLng = RESTAURANT_LOCATION.lng, onChange, language }: DeliveryMapProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>('');

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

  // Resolve the pinned place name whenever the pin moves
  useEffect(() => {
    reverseGeocode(lat, lng).then(addr => {
      if (addr) setResolvedAddress(addr);
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
        alert(language === 'th' ? 'ไม่สามารถระบุตำแหน่ง GPS ได้ — กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือค้นหา/แตะบนแผนที่แทน' : 'Failed to retrieve your GPS location. Please allow location access, or search / tap the map instead.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
    <div className="space-y-3 border border-brand-100 rounded-xl bg-white p-4 shadow-sm" id="delivery-map-container">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <MapPin size={16} className="text-brand-600 animate-bounce" />
          {language === 'th' ? 'ตำแหน่งจัดส่งของคุณ' : 'Your Delivery Location'}
        </h4>
      </div>

      {/* GPS FIRST — the easiest, most reliable way for customers on their phone */}
      <button
        type="button"
        onClick={handleGetCurrentLocation}
        disabled={gpsLoading}
        className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-extrabold shadow-md transition flex items-center justify-center gap-2"
      >
        {gpsLoading ? (
          <RefreshCw size={17} className="animate-spin" />
        ) : (
          <Navigation size={17} />
        )}
        {gpsLoading
          ? (language === 'th' ? 'กำลังค้นหาตำแหน่ง...' : 'Locating...')
          : (language === 'th' ? '📍 ใช้ตำแหน่งปัจจุบันของฉัน (GPS)' : '📍 Use My Current Location (GPS)')}
      </button>
      <p className="text-[11px] text-gray-400 font-bold text-center -mt-1">
        {language === 'th' ? 'หรือค้นหา / แตะ / ลากหมุดบนแผนที่ด้านล่าง' : 'or search / tap / drag the pin on the map below'}
      </p>

      {/* MAP */}
      <div className="relative">
        {hasValidKey ? (
          <APIProvider apiKey={apiKey} version="weekly">
            <div className="space-y-3">
              <PlacesAutocomplete
                language={language}
                onPlaceSelect={handlePlaceSelect}
              />
              <div className="w-full h-[320px] rounded-xl overflow-hidden border border-gray-200 relative bg-gray-50">
                <MapInstance
                  lat={lat}
                  lng={lng}
                  storeLat={storeLat}
                  storeLng={storeLng}
                  onChange={onChange}
                  language={language}
                />
              </div>
            </div>
          </APIProvider>
        ) : (
          <div className="w-full rounded-xl border border-gray-200 overflow-hidden relative h-[250px]">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://maps.google.com/maps?q=${lat},${lng}&hl=${language === 'th' ? 'th' : 'en'}&z=14&output=embed`}
            ></iframe>
          </div>
        )}
      </div>

      {/* Pinned place summary — read-only feedback so customers know the pin landed right */}
      {resolvedAddress && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-black text-emerald-700 uppercase">{language === 'th' ? 'หมุดปักอยู่ที่' : 'Pin location'}</p>
            <p className="text-xs font-bold text-emerald-900 leading-snug break-words">{resolvedAddress}</p>
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
  language
}: DeliveryMapProps) {
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
