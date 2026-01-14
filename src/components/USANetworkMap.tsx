import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CityNode {
  name: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  size: number;
}

interface USANetworkMapProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  height?: string;
  className?: string;
}

const USANetworkMap = ({
  title = "Nationwide",
  subtitle = "On-Demand",
  tagline = "One Network. Every Solution.",
  height = "600px",
  className
}: USANetworkMapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Major US cities with approximate positions on a 2D map (percentage-based)
  const cities: CityNode[] = [
    { name: 'Seattle', x: 15, y: 15, size: 6 },
    { name: 'Portland', x: 12, y: 20, size: 5 },
    { name: 'San Francisco', x: 10, y: 35, size: 7 },
    { name: 'Los Angeles', x: 13, y: 45, size: 8 },
    { name: 'San Diego', x: 14, y: 52, size: 5 },
    { name: 'Phoenix', x: 20, y: 48, size: 6 },
    { name: 'Las Vegas', x: 16, y: 42, size: 5 },
    { name: 'Denver', x: 32, y: 35, size: 6 },
    { name: 'Salt Lake City', x: 25, y: 30, size: 5 },
    { name: 'Dallas', x: 50, y: 55, size: 7 },
    { name: 'Houston', x: 52, y: 62, size: 7 },
    { name: 'Austin', x: 50, y: 60, size: 6 },
    { name: 'Minneapolis', x: 48, y: 22, size: 6 },
    { name: 'Chicago', x: 58, y: 30, size: 8 },
    { name: 'Detroit', x: 62, y: 28, size: 6 },
    { name: 'Atlanta', x: 65, y: 52, size: 7 },
    { name: 'Miami', x: 72, y: 70, size: 7 },
    { name: 'Charlotte', x: 68, y: 48, size: 5 },
    { name: 'Washington DC', x: 72, y: 38, size: 7 },
    { name: 'Philadelphia', x: 75, y: 35, size: 6 },
    { name: 'New York', x: 78, y: 32, size: 9 },
    { name: 'Boston', x: 80, y: 28, size: 7 },
  ];

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Animation frame
    let animationFrame: number;
    let time = 0;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Convert percentage positions to pixel positions
      const cityPositions = cities.map(city => ({
        ...city,
        px: (city.x / 100) * canvas.width,
        py: (city.y / 100) * canvas.height
      }));

      // Draw connections between cities
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
      ctx.lineWidth = 1;

      cityPositions.forEach((city, i) => {
        // Connect to 3-5 nearby cities
        const numConnections = 3 + Math.floor(Math.random() * 3);
        const connections: number[] = [];
        
        // Find nearest cities
        const distances = cityPositions.map((other, j) => ({
          index: j,
          distance: Math.sqrt(
            Math.pow(city.px - other.px, 2) + Math.pow(city.py - other.py, 2)
          )
        }))
        .filter(d => d.index !== i)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, numConnections);

        distances.forEach(({ index }) => {
          const target = cityPositions[index];
          
          // Draw line
          ctx.beginPath();
          ctx.moveTo(city.px, city.py);
          ctx.lineTo(target.px, target.py);
          ctx.stroke();
        });
      });

      // Draw glowing particles along connections (animated)
      const particleCount = 50;
      for (let i = 0; i < particleCount; i++) {
        const cityIndex = Math.floor(Math.random() * cityPositions.length);
        const city = cityPositions[cityIndex];
        
        // Animate particles moving outward
        const angle = (time * 0.5 + i * 137.5) % 360;
        const radius = 20 + (time * 0.3 + i * 10) % 100;
        const px = city.px + Math.cos(angle * Math.PI / 180) * radius;
        const py = city.py + Math.sin(angle * Math.PI / 180) * radius;
        
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 3);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw city nodes with glow effect
      cityPositions.forEach(city => {
        // Outer glow
        const glowGradient = ctx.createRadialGradient(
          city.px, city.py, 0,
          city.px, city.py, city.size * 3
        );
        glowGradient.addColorStop(0, 'rgba(255, 170, 50, 0.8)');
        glowGradient.addColorStop(0.5, 'rgba(255, 140, 30, 0.4)');
        glowGradient.addColorStop(1, 'rgba(255, 140, 30, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        const coreGradient = ctx.createRadialGradient(
          city.px, city.py, 0,
          city.px, city.py, city.size
        );
        coreGradient.addColorStop(0, 'rgba(255, 220, 150, 1)');
        coreGradient.addColorStop(0.7, 'rgba(255, 160, 50, 1)');
        coreGradient.addColorStop(1, 'rgba(255, 120, 30, 0.8)');
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size, 0, Math.PI * 2);
        ctx.fill();

        // Bright center point
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      time += 1;
      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [dimensions, cities]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden",
        "bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900",
        className
      )}
      style={{ height }}
    >
      {/* Canvas for network visualization */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Text overlay */}
      <div className="absolute inset-0 flex flex-col items-start justify-center z-10 px-8 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2">
            {title}
          </h1>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            {subtitle}
          </h2>
          <p className="text-2xl md:text-3xl lg:text-4xl font-semibold text-yellow-400 mb-4">
            {tagline}
          </p>
        </div>
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default USANetworkMap;
