(() => {
  if (!window.L || !L.map || L.map.__cebuNavigationWrapped) return;
  const originalMapFactory = L.map;

  const wrappedMapFactory = function mapWithNavigationDefaults(id, options = {}) {
    const enhanced = {
      ...options,
      zoomControl: false,
      scrollWheelZoom: window.matchMedia('(pointer:fine)').matches,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      preferCanvas: true,
      markerZoomAnimation: false,
      fadeAnimation: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      minZoom: 9,
      maxZoom: 19
    };
    const map = originalMapFactory.call(L, id, enhanced);
    window.__cebuTransportMap = map;
    window.dispatchEvent(new CustomEvent('cebu-map-ready', { detail: { map } }));
    return map;
  };

  wrappedMapFactory.__cebuNavigationWrapped = true;
  L.map = wrappedMapFactory;
})();
