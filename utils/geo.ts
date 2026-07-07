// Haversine formula to calculate distance between two coordinates
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (!response.ok) return null;
        const data = await response.json();
        // Construct a clean display name
        const addr = data.address;
        if (!addr) return data.display_name;
        
        const parts = [
            addr.amenity, 
            addr.road, 
            addr.suburb || addr.village, 
            addr.city || addr.town || addr.county
        ].filter(Boolean);
        
        if (parts.length > 0) return parts.join(', ');
        return data.display_name;
    } catch (e) {
        console.error("Reverse geocoding failed", e);
        return null;
    }
}
