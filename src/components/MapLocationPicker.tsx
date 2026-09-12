import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import Input from './Input'; // Assuming you have this from your UI components

// Fix for Leaflet default marker icon missing in Vite/React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationData {
    locationName: string;
    latitude: number | null;
    longitude: number | null;
    city: string;
    state: string;
}

interface MapLocationPickerProps {
    value: LocationData;
    onChange: (val: LocationData) => void;
    showAreaFields?: boolean;
    preserveLocationName?: boolean;
    helpText?: string;
}

// Sub-component to handle map clicks
function LocationMarker({ value, onChange, preserveLocationName = false }: MapLocationPickerProps) {
    useMapEvents({
        click: async (e) => {
            const { lat, lng } = e.latlng;

            // Free reverse geocoding via OpenStreetMap (Nominatim)
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
                );
                const data = await response.json();

                const address = data.address || {};
                const city = address.city || address.town || address.village || address.county || '';
                const state = address.state || '';
                const locationName = data.display_name.split(',')[0] || 'Selected Location';

                onChange({
                    // A seller-entered stall/bazaar name is more useful than a
                    // reverse-geocoded road label. The pin supplies only the
                    // coordinates when that name is already present.
                    locationName: preserveLocationName && value.locationName.trim() ? value.locationName : locationName,
                    latitude: lat,
                    longitude: lng,
                    city,
                    state,
                });
            } catch (error) {
                console.error("Error fetching location details:", error);
                // Fallback if API fails
                onChange({ ...value, latitude: lat, longitude: lng });
            }
        },
    });

    return value.latitude === null || value.longitude === null ? null : (
        <Marker position={[value.latitude, value.longitude]} />
    );
}

export default function MapLocationPicker({
    value,
    onChange,
    showAreaFields = true,
    preserveLocationName = false,
    helpText = 'Tap the map to pin your location, or enter a stall/place name below if the map is unavailable.',
}: MapLocationPickerProps) {
    // Default to Kuala Lumpur coordinates
    const defaultCenter: [number, number] = [3.1412, 101.6865];

    const currentCenter: [number, number] =
        value.latitude !== null && value.longitude !== null
            ? [value.latitude, value.longitude]
            : defaultCenter;
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    async function searchLocation() {
        const query = value.locationName.trim();
        if (!query) {
            setSearchError('Type a bazaar, market, or place name to search.');
            return;
        }
        setSearching(true);
        setSearchError(null);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`);
            const results: unknown = await response.json();
            const result = Array.isArray(results) ? results[0] as Record<string, unknown> | undefined : undefined;
            const latitude = typeof result?.lat === 'string' ? Number(result.lat) : null;
            const longitude = typeof result?.lon === 'string' ? Number(result.lon) : null;
            if (!response.ok || latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                throw new Error('not-found');
            }
            const address = result?.address && typeof result.address === 'object' ? result.address as Record<string, unknown> : {};
            onChange({
                locationName: value.locationName,
                latitude,
                longitude,
                city: typeof address.city === 'string' ? address.city : typeof address.town === 'string' ? address.town : typeof address.village === 'string' ? address.village : value.city,
                state: typeof address.state === 'string' ? address.state : value.state,
            });
        } catch {
            setSearchError('We could not find that place. You can still type the location name or tap the map.');
        } finally {
            setSearching(false);
        }
    }

    return (
        <div className="map-location-picker">
            <p className="map-location-help">{helpText}</p>

            {/* Map Container  */}
            <div className="map-location-canvas">
                <MapContainer
                    center={currentCenter}
                    zoom={13}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapViewport latitude={value.latitude} longitude={value.longitude} />
                    <LocationMarker value={value} onChange={onChange} preserveLocationName={preserveLocationName} />
                </MapContainer>
            </div>

            {/* Inputs */}
            <div className="map-location-fields">
                <Input
                    label="Search or enter a location name"
                    value={value.locationName}
                    onChange={(e) => {
                        const locationName = e.target.value;
                        // A renamed place must not retain a pin from the old
                        // place. A search or map tap will attach fresh coordinates.
                        const unchanged = locationName.trim() === value.locationName.trim();
                        onChange({
                            ...value,
                            locationName,
                            latitude: unchanged ? value.latitude : null,
                            longitude: unchanged ? value.longitude : null,
                        });
                    }}
                    placeholder="e.g., Bazar Ramadan Kg Baru"
                />
                <button type="button" className="btn btn-secondary btn-md" onClick={() => void searchLocation()} disabled={searching}>{searching ? 'Finding location…' : 'Find on map'}</button>
                {searchError && <p className="map-search-error" role="alert">{searchError}</p>}
                {showAreaFields && <div className="map-location-area-fields">
                    <div>
                        <Input
                            label="City"
                            value={value.city}
                            onChange={(e) => onChange({ ...value, city: e.target.value })}
                            placeholder="City"
                        />
                    </div>
                    <div>
                        <Input
                            label="State"
                            value={value.state}
                            onChange={(e) => onChange({ ...value, state: e.target.value })}
                            placeholder="State"
                        />
                    </div>
                </div>}
            </div>
        </div>
    );
}

function MapViewport({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
    const map = useMap();
    useEffect(() => {
        if (latitude !== null && longitude !== null) {
            map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
        }
    }, [latitude, longitude, map]);
    return null;
}
