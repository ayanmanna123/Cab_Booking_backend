/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of starting point
 * @param {number} lon1 - Longitude of starting point
 * @param {number} lat2 - Latitude of destination point
 * @param {number} lon2 - Longitude of destination point
 * @returns {number} Distance in kilometers rounded to 2 decimal places
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

/**
 * Converts degrees to radians
 */
function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Estimates driving travel duration in minutes based on distance and average urban speed (e.g. 30 km/h)
 * @param {number} distanceKm
 * @param {number} avgSpeedKmh (default 30 km/h in city conditions)
 * @returns {number} duration in minutes
 */
export function estimateDurationMinutes(distanceKm, avgSpeedKmh = 30) {
  if (distanceKm <= 0) return 2;
  const hours = distanceKm / avgSpeedKmh;
  const minutes = Math.ceil(hours * 60) + 3; // +3 minutes buffer for traffic/pickups
  return Math.max(3, minutes);
}

/**
 * Filters an array of drivers to find those within a maximum radius (in kilometers)
 * @param {Array} drivers
 * @param {number} pickupLat
 * @param {number} pickupLng
 * @param {number} maxRadiusKm
 * @returns {Array} drivers with distance and ETA properties sorted by nearest
 */
export function findNearbyDrivers(drivers, pickupLat, pickupLng, maxRadiusKm = 10) {
  return drivers
    .map((driver) => {
      const distance = calculateHaversineDistance(
        pickupLat,
        pickupLng,
        driver.current_latitude,
        driver.current_longitude
      );
      const etaMinutes = estimateDurationMinutes(distance, 35);
      return {
        ...driver,
        distance_km: distance,
        eta_minutes: etaMinutes
      };
    })
    .filter((driver) => driver.distance_km <= maxRadiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * Fetches real driving route polyline from OpenStreetMap / OSRM (Open Source Routing Machine)
 * Leaflet-compatible GeoJSON polyline coordinates
 *
 * @param {Array<[number, number]>} coordsList - Array of [longitude, latitude] points
 * @returns {Promise<{distanceKm: number, durationMin: number, coordinates: Array<[number, number]>}>}
 */
export async function getOsrmRoute(coordsList) {
  try {
    const coordsString = coordsList.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    const response = await fetch(url, { headers: { 'User-Agent': 'CabBookingApp/1.0' } });
    if (!response.ok) throw new Error(`OSRM request failed with status: ${response.status}`);

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
      const durationMin = Math.max(3, Math.ceil(route.duration / 60));

      // GeoJSON returns [lng, lat], convert to Leaflet standard [lat, lng]
      const leafletCoordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      return {
        distanceKm,
        durationMin,
        coordinates: leafletCoordinates,
        source: 'OSRM_OpenStreetMap'
      };
    }
  } catch (err) {
    // Graceful fallback to Haversine if external OSRM service is unreachable
    console.warn('ℹ️ OSRM routing fallback to Haversine calculation:', err.message);
  }

  // Fallback straight line
  return null;
}
