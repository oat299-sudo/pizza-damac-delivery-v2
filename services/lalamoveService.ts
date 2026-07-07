import { RESTAURANT_LOCATION } from '../constants';

export interface LalamoveQuote {
  vehicleType: 'motorcycle' | 'car' | 'pickup';
  vehicleName: string;
  vehicleNameTh: string;
  baseFare: number;
  distanceKm: number;
  distanceFee: number;
  totalFare: number;
  etaMinutes: number;
  quotationId?: string;
  stopIds?: string[];
}

// Lalamove Thailand Pricing Rates
// Motorcycle: Base 33 THB (0-3km), 3-10km (+7.2 THB/km), 10-15km (+8 THB/km), >15km (+14 THB/km)
// Car: Base 85 THB (0-3km), 3-10km (+12 THB/km), 10-20km (+14 THB/km), >20km (+18 THB/km)
// Pickup: Base 250 THB (0-3km), 3-10km (+15 THB/km), 10-30km (+20 THB/km), >30km (+25 THB/km)

export function getLalamoveQuote(distanceKm: number): LalamoveQuote[] {
  if (distanceKm <= 0) return [];

  const roundDistance = Math.max(0.1, Math.round(distanceKm * 100) / 100);

  // 1. Motorcycle
  let mcDistFee = 0;
  if (roundDistance > 3) {
    const remaining = roundDistance - 3;
    if (remaining <= 7) { // up to 10km total
      mcDistFee += remaining * 7.2;
    } else {
      mcDistFee += 7 * 7.2; // for 3-10km
      const remaining2 = remaining - 7;
      if (remaining2 <= 5) { // up to 15km total
        mcDistFee += remaining2 * 8.0;
      } else {
        mcDistFee += 5 * 8.0; // for 10-15km
        const remaining3 = remaining2 - 5;
        mcDistFee += remaining3 * 14.0;
      }
    }
  }
  const mcTotal = Math.round(33 + mcDistFee);

  // 2. Car
  let carDistFee = 0;
  if (roundDistance > 3) {
    const remaining = roundDistance - 3;
    if (remaining <= 7) { // up to 10km total
      carDistFee += remaining * 12.0;
    } else {
      carDistFee += 7 * 12.0;
      const remaining2 = remaining - 7;
      if (remaining2 <= 10) { // up to 20km total
        carDistFee += remaining2 * 14.0;
      } else {
        carDistFee += 10 * 14.0;
        const remaining3 = remaining2 - 10;
        carDistFee += remaining3 * 18.0;
      }
    }
  }
  const carTotal = Math.round(85 + carDistFee);

  // 3. Pickup
  let pickDistFee = 0;
  if (roundDistance > 3) {
    const remaining = roundDistance - 3;
    if (remaining <= 7) {
      pickDistFee += remaining * 15.0;
    } else {
      pickDistFee += 7 * 15.0;
      const remaining2 = remaining - 7;
      if (remaining2 <= 20) {
        pickDistFee += remaining2 * 20.0;
      } else {
        pickDistFee += 20 * 20.0;
        const remaining3 = remaining2 - 20;
        pickDistFee += remaining3 * 25.0;
      }
    }
  }
  const pickTotal = Math.round(250 + pickDistFee);

  return [
    {
      vehicleType: 'motorcycle',
      vehicleName: 'Motorcycle (Speedy)',
      vehicleNameTh: 'รถจักรยานยนต์ (ด่วนที่สุด)',
      baseFare: 33,
      distanceKm: roundDistance,
      distanceFee: Math.round(mcDistFee),
      totalFare: mcTotal,
      etaMinutes: Math.round(5 + roundDistance * 2.5),
    },
    {
      vehicleType: 'car',
      vehicleName: 'Car (4-Wheel)',
      vehicleNameTh: 'รถยนต์ 4 ล้อ (ถนอมอาหาร)',
      baseFare: 85,
      distanceKm: roundDistance,
      distanceFee: Math.round(carDistFee),
      totalFare: carTotal,
      etaMinutes: Math.round(10 + roundDistance * 3.5),
    },
    {
      vehicleType: 'pickup',
      vehicleName: 'Pickup Truck',
      vehicleNameTh: 'รถกระบะขนส่ง (ปาร์ตี้ใหญ่)',
      baseFare: 250,
      distanceKm: roundDistance,
      distanceFee: Math.round(pickDistFee),
      totalFare: pickTotal,
      etaMinutes: Math.round(15 + roundDistance * 4.0),
    }
  ];
}

export interface MockRider {
  name: string;
  phone: string;
}

const MOCK_RIDERS: MockRider[] = [
  { name: 'สมชาย แสนดี (Somchai S.)', phone: '089-123-4567' },
  { name: 'อนันต์ เรืองฤทธิ์ (Anan R.)', phone: '081-987-6543' },
  { name: 'เกียรติศักดิ์ มั่นคง (Kiattisak M.)', phone: '086-555-7788' },
  { name: 'วิชัย ชนะภัย (Wichai C.)', phone: '092-444-1122' }
];

export function getRandomMockRider(): MockRider {
  const index = Math.floor(Math.random() * MOCK_RIDERS.length);
  return MOCK_RIDERS[index];
}

export async function fetchRealLalamoveQuote(
  lat: number,
  lng: number,
  address: string,
  customerName: string,
  customerPhone: string
): Promise<LalamoveQuote[] | null> {
  try {
    const vehicles: ('motorcycle' | 'car' | 'pickup')[] = ['motorcycle', 'car', 'pickup'];
    
    const quotePromises = vehicles.map(async (v) => {
      try {
        const lalaServiceType = v === 'motorcycle' ? 'MOTORCYCLE' : v === 'car' ? 'CAR' : 'PICKUP';
        
        const payload = {
          data: {
            serviceType: lalaServiceType,
            language: "th_TH",
            stops: [
              {
                coordinates: {
                  lat: String(RESTAURANT_LOCATION.lat),
                  lng: String(RESTAURANT_LOCATION.lng)
                },
                address: "Pizza Damac Nonthaburi"
              },
              {
                coordinates: {
                  lat: String(lat),
                  lng: String(lng)
                },
                address: address || "Customer Address"
              }
            ],
            item: {
              quantity: "1",
              weight: "1.0",
              categories: ["FOOD_DELIVERY"],
              handlingInstructions: ["KEEP_UPRIGHT"]
            }
          }
        };

        const res = await fetch('/api/lalamove/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.text();
          console.warn(`Lalamove API quote error for ${v}:`, err);
          return null;
        }

        const responseData = await res.json();
        const quoteId = responseData.data.quotationId;
        const totalFare = Math.round(parseFloat(responseData.data.priceBreakdown.total));
        const distanceMeters = parseFloat(responseData.data.distance.value);
        const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
        const baseFare = Math.round(parseFloat(responseData.data.priceBreakdown.base || "33"));
        const stopIds = responseData.data.stops.map((s: any) => s.stopId);

        return {
          vehicleType: v,
          vehicleName: v === 'motorcycle' ? 'Motorcycle (Real Lalamove)' : v === 'car' ? 'Car (Real Lalamove)' : 'Pickup (Real Lalamove)',
          vehicleNameTh: v === 'motorcycle' ? 'รถจักรยานยนต์ (Lalamove จริง)' : v === 'car' ? 'รถยนต์ 4 ล้อ (Lalamove จริง)' : 'รถกระบะขนส่ง (Lalamove จริง)',
          baseFare: baseFare,
          distanceKm: distanceKm,
          distanceFee: totalFare - baseFare,
          totalFare: totalFare,
          etaMinutes: Math.round(5 + distanceKm * 2.5),
          quotationId: quoteId,
          stopIds: stopIds
        };
      } catch (err) {
        console.warn(`Failed to fetch real Lalamove quote for ${v}`, err);
        return null;
      }
    });

    const results = await Promise.all(quotePromises);
    const validQuotes = results.filter((q): q is LalamoveQuote => q !== null);
    return validQuotes.length > 0 ? validQuotes : null;
  } catch (error) {
    console.warn("Real Lalamove API Quoting failed, falling back to simulator.", error);
    return null;
  }
}

export async function createRealLalamoveOrder(
  quotationId: string,
  customerName: string,
  customerPhone: string,
  stopIds: string[]
): Promise<{ orderId: string; shareLink?: string } | null> {
  try {
    if (!stopIds || stopIds.length < 2) {
      console.warn("Cannot create Lalamove order without valid stopIds from quotation.");
      return null;
    }

    const payload = {
      data: {
        quotationId: quotationId,
        sender: {
          stopId: stopIds[0],
          name: "Pizza Damac Nonthaburi",
          phone: "+6621234567"
        },
        recipients: [
          {
            stopId: stopIds[1],
            name: customerName || "Customer",
            phone: customerPhone || "+66890000000"
          }
        ],
        isConfirmByCustomer: false
      }
    };

    const res = await fetch('/api/lalamove/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("Failed to place real Lalamove order:", err);
      return null;
    }

    const responseData = await res.json();
    return {
      orderId: responseData.data.orderId,
      shareLink: responseData.data.shareLink
    };
  } catch (error) {
    console.warn("Real Lalamove order failed, falling back to simulator.", error);
    return null;
  }
}

export interface LalamoveStatusResponse {
  configured: boolean;
  status: 'online' | 'offline';
  message: string;
  error?: any;
}

export async function checkLalamoveStatus(): Promise<LalamoveStatusResponse> {
  try {
    const res = await fetch('/api/lalamove/status');
    if (!res.ok) {
      return {
        configured: false,
        status: 'offline',
        message: `HTTP error status: ${res.status}`
      };
    }
    return await res.json();
  } catch (error: any) {
    return {
      configured: false,
      status: 'offline',
      message: `Connection failed: ${error.message}`
    };
  }
}
