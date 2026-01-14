import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface USAMapProperProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  height?: string;
  className?: string;
  showButton?: boolean;
}

interface City {
  name: string;
  lat: number;
  lon: number;
  size: number;
}

const cities: City[] = [
  { name: 'Seattle', lat: 47.6062, lon: -122.3321, size: 5 },
  { name: 'Portland', lat: 45.5152, lon: -122.6784, size: 4 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, size: 6 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, size: 7 },
  { name: 'San Diego', lat: 32.7157, lon: -117.1611, size: 5 },
  { name: 'Phoenix', lat: 33.4484, lon: -112.0740, size: 6 },
  { name: 'Las Vegas', lat: 36.1699, lon: -115.1398, size: 5 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903, size: 6 },
  { name: 'Dallas', lat: 32.7767, lon: -96.7970, size: 6 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698, size: 6 },
  { name: 'Austin', lat: 30.2672, lon: -97.7431, size: 5 },
  { name: 'Minneapolis', lat: 44.9778, lon: -93.2650, size: 5 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, size: 7 },
  { name: 'Detroit', lat: 42.3314, lon: -83.0458, size: 5 },
  { name: 'Atlanta', lat: 33.7490, lon: -84.3880, size: 6 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918, size: 6 },
  { name: 'Charlotte', lat: 35.2271, lon: -80.8431, size: 5 },
  { name: 'Washington DC', lat: 38.9072, lon: -77.0369, size: 6 },
  { name: 'Philadelphia', lat: 39.9526, lon: -75.1652, size: 6 },
  { name: 'New York', lat: 40.7128, lon: -74.0060, size: 8 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589, size: 6 },
];

const USAMapProper = ({
  title = "Nationwide",
  subtitle = "On-Demand",
  tagline = "Waste Solutions.",
  description = "Same-Day, Pay-On-Demand, Nationwide",
  height = "600px",
  className,
  showButton = false
}: USAMapProperProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoData, setGeoData] = useState<any>(null);

  // Load GeoJSON data
  useEffect(() => {
    fetch('/assets/us-states.json')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error('Failed to load GeoJSON:', err));
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !geoData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 500;

    // Project lat/lon to canvas coordinates
    const project = (lon: number, lat: number) => {
      // Simple Mercator-like projection
      const x = ((lon + 130) / 60) * canvas.width;
      const y = ((50 - lat) / 25) * canvas.height;
      return { x, y };
    };

    let animationFrame: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw USA states
      geoData.features.forEach((feature: any) => {
        const coordinates = feature.geometry.coordinates;
        const polygons = feature.geometry.type === 'MultiPolygon' ? coordinates : [coordinates];

        polygons.forEach((polygon: any) => {
          polygon.forEach((ring: any) => {
            ctx.beginPath();
            ring.forEach((coord: number[], i: number) => {
              const { x, y } = project(coord[0], coord[1]);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            });
            ctx.closePath();

            // Glowing blue border
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00d4ff';
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.restore();
          });
        });
      });

      // Project cities
      const projectedCities = cities.map(city => ({
        ...city,
        ...project(city.lon, city.lat)
      }));

      // Draw connections
      projectedCities.forEach((city, i) => {
        projectedCities.forEach((other, j) => {
          if (i >= j) return;
          const dist = Math.sqrt(Math.pow(city.x - other.x, 2) + Math.pow(city.y - other.y, 2));
          if (dist < 200) {
            ctx.save();
            ctx.strokeStyle = '#88ccff';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(city.x, city.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
            ctx.restore();
          }
        });
      });

      // Draw particles
      for (let i = 0; i < 100; i++) {
        const cityIndex = Math.floor((i / 100) * projectedCities.length);
        const city = projectedCities[cityIndex];
        const angle = (time * 0.5 + i * 137.5) % 360;
        const radius = 10 + ((time * 0.3 + i * 5) % 50);
        const px = city.x + Math.cos(angle * Math.PI / 180) * radius;
        const py = city.y + Math.sin(angle * Math.PI / 180) * radius;

        ctx.save();
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 2);
        gradient.addColorStop(0, 'rgba(255, 220, 150, 0.9)');
        gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw city nodes
      projectedCities.forEach(city => {
        // Extra large glow
        ctx.save();
        const extraGlow = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, city.size * 5);
        extraGlow.addColorStop(0, 'rgba(255, 180, 70, 0.6)');
        extraGlow.addColorStop(0.3, 'rgba(255, 150, 50, 0.3)');
        extraGlow.addColorStop(1, 'rgba(255, 140, 30, 0)');
        ctx.fillStyle = extraGlow;
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.size * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Large glow
        ctx.save();
        const outerGlow = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, city.size * 3);
        outerGlow.addColorStop(0, 'rgba(255, 190, 80, 0.9)');
        outerGlow.addColorStop(0.5, 'rgba(255, 160, 60, 0.6)');
        outerGlow.addColorStop(1, 'rgba(255, 140, 40, 0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Core
        ctx.save();
        const coreGradient = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, city.size);
        coreGradient.addColorStop(0, 'rgba(255, 250, 220, 1)');
        coreGradient.addColorStop(0.5, 'rgba(255, 200, 100, 1)');
        coreGradient.addColorStop(1, 'rgba(255, 160, 60, 1)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Bright center
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      time += 1;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [geoData]);

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <div className="absolute inset-0 opacity-30">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Canvas with 3D transform */}
      <div className="absolute inset-0 flex items-center justify-end pr-8">
        <div
          style={{
            transform: 'perspective(1200px) rotateX(20deg) rotateY(-10deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-[800px] h-[500px]"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(0, 180, 255, 0.3))',
            }}
          />
        </div>
      </div>

      {/* Text overlay */}
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
          <p className="text-xl md:text-2xl font-semibold text-yellow-400 mb-2">
            One Network. Every Waste Solution.
          </p>
          <p className="text-lg md:text-xl text-gray-300 mb-6">
            {description}
          </p>
          {showButton && (
            <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 px-8 rounded text-lg transition-colors">
              REQUEST SERVICE
            </button>
          )}
        </div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default USAMapProper;
