import { useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

interface CityNode {
  name: string;
  lat: number;
  lon: number;
  size: number;
}

interface USA3DNetworkMapProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  height?: string;
  className?: string;
  showButton?: boolean;
}

// Major US cities with actual coordinates
const cities: CityNode[] = [
  { name: 'Seattle', lat: 47.6062, lon: -122.3321, size: 0.02 },
  { name: 'Portland', lat: 45.5152, lon: -122.6784, size: 0.015 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, size: 0.025 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, size: 0.03 },
  { name: 'San Diego', lat: 32.7157, lon: -117.1611, size: 0.02 },
  { name: 'Phoenix', lat: 33.4484, lon: -112.0740, size: 0.025 },
  { name: 'Las Vegas', lat: 36.1699, lon: -115.1398, size: 0.02 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903, size: 0.025 },
  { name: 'Dallas', lat: 32.7767, lon: -96.7970, size: 0.025 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698, size: 0.025 },
  { name: 'Austin', lat: 30.2672, lon: -97.7431, size: 0.02 },
  { name: 'Minneapolis', lat: 44.9778, lon: -93.2650, size: 0.02 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, size: 0.03 },
  { name: 'Detroit', lat: 42.3314, lon: -83.0458, size: 0.02 },
  { name: 'Atlanta', lat: 33.7490, lon: -84.3880, size: 0.025 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918, size: 0.025 },
  { name: 'Charlotte', lat: 35.2271, lon: -80.8431, size: 0.02 },
  { name: 'Washington DC', lat: 38.9072, lon: -77.0369, size: 0.025 },
  { name: 'Philadelphia', lat: 39.9526, lon: -75.1652, size: 0.025 },
  { name: 'New York', lat: 40.7128, lon: -74.0060, size: 0.035 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589, size: 0.025 },
];

// Convert lat/lon to 3D coordinates (simplified projection)
function latLonTo3D(lat: number, lon: number, scale: number = 1) {
  // Center USA roughly at -98°W, 39°N
  const centerLon = -98;
  const centerLat = 39;
  
  // Normalize coordinates relative to center
  const x = (lon - centerLon) * scale * 0.02;
  const y = (lat - centerLat) * scale * 0.025;
  
  return { x, y, z: 0 };
}

// USA Map Component with state boundaries
function USAMap() {
  const meshRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    // Load GeoJSON data
    fetch('/assets/us-states.json')
      .then(res => res.json())
      .then(data => {
        if (!meshRef.current) return;
        
        // Process each state
        data.features.forEach((feature: any) => {
          const coordinates = feature.geometry.coordinates;
          
          // Handle MultiPolygon and Polygon
          const polygons = feature.geometry.type === 'MultiPolygon' 
            ? coordinates 
            : [coordinates];
          
          polygons.forEach((polygon: any) => {
            const outerRing = polygon[0];
            
            // Create line geometry for state boundary
            const points: THREE.Vector3[] = [];
            outerRing.forEach((coord: number[]) => {
              const pos = latLonTo3D(coord[1], coord[0], 1);
              points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
            });
            
            // Create glowing line
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
              color: 0x00d4ff,
              transparent: true,
              opacity: 0.6,
              linewidth: 2
            });
            
            const line = new THREE.Line(geometry, material);
            meshRef.current?.add(line);
          });
        });
      });
  }, []);
  
  return <group ref={meshRef} />;
}

// City nodes with glow effect
function CityNodes() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      // Subtle pulsing animation
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      groupRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Mesh) {
          child.scale.setScalar(scale + i * 0.02);
        }
      });
    }
  });
  
  return (
    <group ref={groupRef}>
      {cities.map((city, index) => {
        const pos = latLonTo3D(city.lat, city.lon, 1);
        
        return (
          <group key={city.name} position={[pos.x, pos.y, pos.z + 0.05]}>
            {/* Outer glow */}
            <mesh>
              <sphereGeometry args={[city.size * 3, 16, 16]} />
              <meshBasicMaterial
                color={0xffaa44}
                transparent
                opacity={0.2}
              />
            </mesh>
            
            {/* Middle glow */}
            <mesh>
              <sphereGeometry args={[city.size * 1.5, 16, 16]} />
              <meshBasicMaterial
                color={0xffcc66}
                transparent
                opacity={0.5}
              />
            </mesh>
            
            {/* Core */}
            <mesh>
              <sphereGeometry args={[city.size, 16, 16]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
            
            {/* Point light for glow effect */}
            <pointLight
              color={0xffaa44}
              intensity={city.size * 100}
              distance={0.5}
            />
          </group>
        );
      })}
    </group>
  );
}

// Connection lines between cities
function ConnectionLines() {
  const linesRef = useRef<THREE.Group>(null);
  
  useEffect(() => {
    if (!linesRef.current) return;
    
    // Create connections between nearby cities
    cities.forEach((city, i) => {
      const pos1 = latLonTo3D(city.lat, city.lon, 1);
      
      // Connect to 3-4 nearest cities
      const connections = cities
        .map((otherCity, j) => ({
          city: otherCity,
          index: j,
          distance: Math.sqrt(
            Math.pow(city.lat - otherCity.lat, 2) +
            Math.pow(city.lon - otherCity.lon, 2)
          )
        }))
        .filter(c => c.index !== i)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4);
      
      connections.forEach(({ city: otherCity }) => {
        const pos2 = latLonTo3D(otherCity.lat, otherCity.lon, 1);
        
        const points = [
          new THREE.Vector3(pos1.x, pos1.y, pos1.z + 0.05),
          new THREE.Vector3(pos2.x, pos2.y, pos2.z + 0.05)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.3,
          linewidth: 1
        });
        
        const line = new THREE.Line(geometry, material);
        linesRef.current?.add(line);
      });
    });
  }, []);
  
  return <group ref={linesRef} />;
}

// Animated particles
function Particles() {
  const particlesRef = useRef<THREE.Points>(null);
  
  useEffect(() => {
    if (!particlesRef.current) return;
    
    const count = 200;
    const positions = new Float32Array(count * 3);
    
    cities.forEach((city, i) => {
      const pos = latLonTo3D(city.lat, city.lon, 1);
      
      for (let j = 0; j < 10; j++) {
        const idx = (i * 10 + j) * 3;
        if (idx < count * 3) {
          positions[idx] = pos.x + (Math.random() - 0.5) * 0.3;
          positions[idx + 1] = pos.y + (Math.random() - 0.5) * 0.3;
          positions[idx + 2] = pos.z + Math.random() * 0.1;
        }
      }
    });
    
    particlesRef.current.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
  }, []);
  
  useFrame((state) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += 0.001;
        if (positions[i + 2] > 0.2) {
          positions[i + 2] = 0;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry />
      <pointsMaterial
        size={0.01}
        color={0xffdd88}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Main 3D Scene
function Scene() {
  return (
    <>
      {/* Camera positioned for angled perspective view */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        target={[0, 0, 0]}
      />
      
      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* USA map with state boundaries */}
      <USAMap />
      
      {/* Connection lines */}
      <ConnectionLines />
      
      {/* City nodes */}
      <CityNodes />
      
      {/* Animated particles */}
      <Particles />
    </>
  );
}

const USA3DNetworkMap = ({
  title = "Nationwide",
  subtitle = "On-Demand",
  tagline = "Waste Solutions.",
  description = "Same-Day, Pay-On-Demand, Nationwide",
  height = "600px",
  className,
  showButton = false
}: USA3DNetworkMapProps) => {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        className
      )}
      style={{ height }}
    >
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <Canvas
          camera={{
            position: [0, -1, 2],
            fov: 50
          }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* Text overlay - LEFT SIDE */}
      <div className="absolute inset-0 flex flex-col items-start justify-center z-10 px-8 md:px-12 lg:px-16 max-w-2xl">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            {title}
          </h1>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            {subtitle}
          </h2>
          <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {tagline}
          </h3>
          <p className="text-xl md:text-2xl font-semibold text-yellow-400 mb-6">
            {description}
          </p>
          {showButton && (
            <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 px-8 rounded text-lg transition-colors">
              REQUEST SERVICE
            </button>
          )}
        </div>
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default USA3DNetworkMap;
