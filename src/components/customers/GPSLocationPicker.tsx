import React, { useState } from 'react';
import { MapPin, Navigation, Compass, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface GPSLocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationCaptured: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

export const GPSLocationPicker: React.FC<GPSLocationPickerProps> = ({
  latitude,
  longitude,
  onLocationCaptured,
  readOnly = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasLocation = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null;

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your device/browser.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onLocationCaptured(lat, lng);
        setLoading(false);
        setSuccessMsg(`Location captured: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      },
      (error) => {
        setLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg('Location permission denied. Address will be used for delivery.');
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMsg('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            setErrorMsg('Location request timed out. Please try again.');
            break;
          default:
            setErrorMsg('An unknown error occurred while getting location.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const openGoogleMapsDirections = () => {
    if (hasLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="bg-[#FAFAFA] dark:bg-[#1F1F1F] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-[#525252] dark:text-[#D4D4D4] uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#E31B23]" /> Customer GPS Navigation Location
        </label>
        {hasLocation && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="w-3 h-3" /> Saved
          </span>
        )}
      </div>

      {hasLocation ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-[#171717] p-3 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs">
          <div className="text-xs font-mono text-[#525252] dark:text-[#D4D4D4]">
            <span className="text-[#737373]">Lat:</span> <strong className="text-[#171717] dark:text-white">{latitude?.toFixed(6)}</strong>{' '}
            <span className="text-[#737373] ml-2">Lng:</span> <strong className="text-[#171717] dark:text-white">{longitude?.toFixed(6)}</strong>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={openGoogleMapsDirections}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> Open Directions
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1 bg-[#FAFAFA] dark:bg-[#1F1F1F] hover:bg-[#F1F1F1] text-[#171717] dark:text-white text-xs font-bold px-2.5 py-2 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] transition-colors"
                title="Update Location"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Update</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2 space-y-2">
          {!readOnly && (
            <button
              type="button"
              onClick={handleCaptureLocation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#E31B23] hover:bg-[#C9151C] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-[0_6px_18px_rgba(227,27,35,0.16)] transition-all"
            >
              <Compass className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Requesting GPS Location...' : 'Capture Current Location'}
            </button>
          )}
          <p className="text-[11px] text-[#737373]">
            Uses your device GPS to store exact delivery coordinates for Google Maps navigation.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs text-[#D97706] bg-[#FFFBEB] p-2 rounded-lg border border-amber-200/60">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-1.5 text-xs text-[#16A34A] bg-[#F0FDF4] p-2 rounded-lg border border-emerald-200/60">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
