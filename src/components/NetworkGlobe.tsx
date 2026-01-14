import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

interface NetworkNode {
  lat: number;
  lng: number;
  city: string;
  size: number;
}

interface NetworkArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

const NetworkGlobe = () => {
  const globeEl = useRef<any>();
  const [arcsData, setArcsData] = useState<NetworkArc[]>([]);
  const [pointsData, setPointsData] = useState<NetworkNode[]>([]);

  useEffect(() => {
    // Major US cities network nodes
    const cities: NetworkNode[] = [
      { lat: 40.7128, lng: -74.0060, city: 'New York', size: 0.8 },
      { lat: 34.0522, lng: -118.2437, city: 'Los Angeles', size: 0.8 },
      { lat: 41.8781, lng: -87.6298, city: 'Chicago', size: 0.7 },
      { lat: 29.7604, lng: -95.3698, city: 'Houston', size: 0.6 },
      { lat: 33.4484, lng: -112.0740, city: 'Phoenix', size: 0.5 },
      { lat: 39.7392, lng: -104.9903, city: 'Denver', size: 0.6 },
      { lat: 47.6062, lng: -122.3321, city: 'Seattle', size: 0.6 },
      { lat: 37.7749, lng: -122.4194, city: 'San Francisco', size: 0.7 },
      { lat: 32.7767, lng: -96.7970, city: 'Dallas', size: 0.6 },
      { lat: 25.7617, lng: -80.1918, city: 'Miami', size: 0.6 },
      { lat: 33.7490, lng: -84.3880, city: 'Atlanta', size: 0.6 },
      { lat: 42.3601, lng: -71.0589, city: 'Boston', size: 0.6 },
      { lat: 38.9072, lng: -77.0369, city: 'Washington DC', size: 0.7 },
      { lat: 39.9526, lng: -75.1652, city: 'Philadelphia', size: 0.5 },
      { lat: 36.1699, lng: -115.1398, city: 'Las Vegas', size: 0.5 },
      { lat: 45.5152, lng: -122.6784, city: 'Portland', size: 0.5 },
      { lat: 30.2672, lng: -97.7431, city: 'Austin', size: 0.5 },
      { lat: 35.2271, lng: -80.8431, city: 'Charlotte', size: 0.4 },
      { lat: 39.7684, lng: -86.1581, city: 'Indianapolis', size: 0.4 },
      { lat: 37.3382, lng: -121.8863, city: 'San Jose', size: 0.5 },
    ];

    // Create network connections between cities
    const connections: NetworkArc[] = [];
    const colors = ['#ff6b35', '#f7931e', '#fdc500', '#00b4d8', '#0077b6'];
    
    // Create a mesh network with some randomization
    cities.forEach((city, i) => {
      // Connect each city to 3-5 other cities
      const numConnections = Math.floor(Math.random() * 3) + 3;
      const connectedIndices = new Set<number>();
      
      while (connectedIndices.size < numConnections && connectedIndices.size < cities.length - 1) {
        const targetIndex = Math.floor(Math.random() * cities.length);
        if (targetIndex !== i && !connectedIndices.has(targetIndex)) {
          connectedIndices.add(targetIndex);
          const targetCity = cities[targetIndex];
          
          connections.push({
            startLat: city.lat,
            startLng: city.lng,
            endLat: targetCity.lat,
            endLng: targetCity.lng,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }
    });

    setPointsData(cities);
    setArcsData(connections);

    // Position camera to focus on USA
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: 39.8283,
        lng: -98.5795,
        altitude: 1.5
      }, 1000);
    }
  }, []);

  return (
    <div className="w-full h-full">
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Points (cities)
        pointsData={pointsData}
        pointAltitude={0.01}
        pointRadius={(d: any) => d.size * 0.3}
        pointColor={() => '#ffaa00'}
        pointLabel={(d: any) => d.city}
        pointsMerge={true}
        
        // Arcs (connections)
        arcsData={arcsData}
        arcColor={(d: any) => d.color}
        arcAltitude={0.3}
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={3000}
        arcsTransitionDuration={0}
        
        // Atmosphere
        atmosphereColor="#4a90e2"
        atmosphereAltitude={0.15}
        
        // Animation
        animateIn={true}
      />
    </div>
  );
};

export default NetworkGlobe;
