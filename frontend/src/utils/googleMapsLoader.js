let loadPromise = null;

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function isGoogleMapsConfigured() {
  return Boolean(API_KEY);
}

/** Resolves once window.google.maps is available. Safe to call from multiple components. */
export function loadGoogleMaps() {
  if (!API_KEY) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps JS API"));
    document.head.appendChild(script);
  });
  return loadPromise;
}
