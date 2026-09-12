import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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
}

// Sub-component to handle map clicks
function LocationMarker({ value, onChange }: MapLocationPickerProps) {
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
                    locationName,
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

export default function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
    // Default to Kuala Lumpur coordinates
    const defaultCenter: [number, number] = [3.1412, 101.6865];

    const currentCenter: [number, number] =
        value.latitude && value.longitude
            ? [value.latitude, value.longitude]
            : defaultCenter;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <p style={{ fontSize: '14px', color: '#888' }}>Tap anywhere on the map to pin your location.</p>

            {/* Map Container  */}
            <div style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', position: 'relative', zIndex: 0 }}>
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
                    <LocationMarker value={value} onChange={onChange} />
                </MapContainer>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Input
                    label="Location Name / Stall Name"
                    value={value.locationName}
                    onChange={(e) => onChange({ ...value, locationName: e.target.value })}
                    placeholder="e.g., Bazar Ramadan Kg Baru"
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                        <Input
                            label="City"
                            value={value.city}
                            onChange={(e) => onChange({ ...value, city: e.target.value })}
                            placeholder="City"
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Input
                            label="State"
                            value={value.state}
                            onChange={(e) => onChange({ ...value, state: e.target.value })}
                            placeholder="State"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
