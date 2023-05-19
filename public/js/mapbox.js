/* eslint-disable */

export const displayMap = locations => {
    mapboxgl.accessToken =
        'pk.eyJ1IjoiYXVyYWV4ZSIsImEiOiJjbGhvcjNqbHYwOW1uM2pwNnA5ZG00NDB2In0.FLYcaX6IodZu3_CWhunGgg';

    const map = new mapboxgl.Map({
        container: 'map', // container ID
        style: 'mapbox://styles/auraexe/clhor8uvk00lt01r5hpjjbav4', // style URL
        scrollZoom: false,
        // center: [-118.167194, 34.137508], // starting position [lng, lat]
        // zoom: 9, // starting zoom
        // interactive: false,
    });

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach(loc => {
        // Create marker
        const el = document.createElement('div');
        el.className = 'marker';

        // Add marker
        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(loc.coordinates)
            .addTo(map);

        // Add popup

        new mapboxgl.Popup({ offset: 30 })
            .setLngLat(loc.coordinates)
            .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
            .addTo(map);

        // Extend map bounds to include current location
        bounds.extend(loc.coordinates);
    });

    map.fitBounds(bounds, {
        padding: { top: 200, bottom: 150, left: 100, right: 100 },
    });
};
