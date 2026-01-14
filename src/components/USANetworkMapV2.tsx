import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CityNode {
  name: string;
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  size: number;
}

interface USANetworkMapV2Props {
  title?: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  height?: string;
  className?: string;
  showButton?: boolean;
}

const USANetworkMapV2 = ({
  title = "Nationwide",
  subtitle = "On-Demand",
  tagline = "Waste Solutions.",
  description = "Same-Day, Pay-On-Demand, Nationwide",
  height = "600px",
  className,
  showButton = false
}: USANetworkMapV2Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Major US cities positioned to match USA geography (percentage-based for right side of screen)
  const cities: CityNode[] = [
    // West Coast
    { name: 'Seattle', x: 58, y: 18, size: 5 },
    { name: 'Portland', x: 57, y: 22, size: 4 },
    { name: 'San Francisco', x: 55, y: 35, size: 6 },
    { name: 'Los Angeles', x: 57, y: 42, size: 7 },
    { name: 'San Diego', x: 58, y: 47, size: 4 },
    
    // Southwest
    { name: 'Phoenix', x: 63, y: 45, size: 5 },
    { name: 'Las Vegas', x: 60, y: 40, size: 4 },
    { name: 'Albuquerque', x: 67, y: 43, size: 3 },
    
    // Mountain
    { name: 'Denver', x: 70, y: 35, size: 5 },
    { name: 'Salt Lake City', x: 64, y: 32, size: 4 },
    
    // Texas
    { name: 'Dallas', x: 77, y: 48, size: 6 },
    { name: 'Houston', x: 78, y: 54, size: 6 },
    { name: 'Austin', x: 77, y: 52, size: 5 },
    { name: 'San Antonio', x: 76, y: 54, size: 4 },
    
    // Midwest
    { name: 'Minneapolis', x: 78, y: 24, size: 5 },
    { name: 'Chicago', x: 83, y: 30, size: 7 },
    { name: 'Detroit', x: 86, y: 28, size: 5 },
    { name: 'St. Louis', x: 81, y: 38, size: 4 },
    { name: 'Kansas City', x: 77, y: 38, size: 4 },
    
    // South
    { name: 'Atlanta', x: 87, y: 47, size: 6 },
    { name: 'Miami', x: 92, y: 60, size: 6 },
    { name: 'Charlotte', x: 90, y: 44, size: 4 },
    { name: 'Nashville', x: 84, y: 42, size: 4 },
    { name: 'New Orleans', x: 81, y: 56, size: 5 },
    
    // Northeast
    { name: 'Washington DC', x: 92, y: 38, size: 6 },
    { name: 'Philadelphia', x: 94, y: 36, size: 5 },
    { name: 'New York', x: 95, y: 33, size: 8 },
    { name: 'Boston', x: 96, y: 30, size: 6 },
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

      // Draw connections between cities (mesh network)
      cityPositions.forEach((city, i) => {
        // Find nearest cities for connections
        const distances = cityPositions
          .map((other, j) => ({
            index: j,
            distance: Math.sqrt(
              Math.pow(city.px - other.px, 2) + Math.pow(city.py - other.py, 2)
            )
          }))
          .filter(d => d.index !== i)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 4); // Connect to 4 nearest cities

        distances.forEach(({ index }) => {
          const target = cityPositions[index];
          
          // Draw thin blue/cyan connection line
          ctx.strokeStyle = 'rgba(100, 180, 255, 0.25)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(city.px, city.py);
          ctx.lineTo(target.px, target.py);
          ctx.stroke();
        });
      });

      // Draw animated particles along connections
      const particleCount = 80;
      for (let i = 0; i < particleCount; i++) {
        const cityIndex = Math.floor((i / particleCount) * cityPositions.length);
        const city = cityPositions[cityIndex];
        
        // Animate particles moving outward
        const angle = (time * 0.8 + i * 137.5) % 360;
        const radius = 15 + ((time * 0.5 + i * 8) % 80);
        const px = city.px + Math.cos(angle * Math.PI / 180) * radius;
        const py = city.py + Math.sin(angle * Math.PI / 180) * radius;
        
        // Small glowing particles
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 2);
        gradient.addColorStop(0, 'rgba(255, 220, 150, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw city nodes with strong glow effect (matching reference)
      cityPositions.forEach(city => {
        // Large outer glow
        const outerGlow = ctx.createRadialGradient(
          city.px, city.py, 0,
          city.px, city.py, city.size * 4
        );
        outerGlow.addColorStop(0, 'rgba(255, 180, 70, 0.6)');
        outerGlow.addColorStop(0.4, 'rgba(255, 150, 50, 0.3)');
        outerGlow.addColorStop(1, 'rgba(255, 140, 30, 0)');
        
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // Medium glow
        const mediumGlow = ctx.createRadialGradient(
          city.px, city.py, 0,
          city.px, city.py, city.size * 2
        );
        mediumGlow.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
        mediumGlow.addColorStop(0.6, 'rgba(255, 160, 60, 0.6)');
        mediumGlow.addColorStop(1, 'rgba(255, 140, 40, 0)');
        
        ctx.fillStyle = mediumGlow;
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        const coreGradient = ctx.createRadialGradient(
          city.px, city.py, 0,
          city.px, city.py, city.size
        );
        coreGradient.addColorStop(0, 'rgba(255, 240, 200, 1)');
        coreGradient.addColorStop(0.5, 'rgba(255, 180, 80, 1)');
        coreGradient.addColorStop(1, 'rgba(255, 140, 50, 0.9)');
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size, 0, Math.PI * 2);
        ctx.fill();

        // Bright white center
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(city.px, city.py, city.size * 0.3, 0, Math.PI * 2);
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
        "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900",
        className
      )}
      style={{ height }}
    >
      {/* Canvas for network visualization */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Text overlay - LEFT SIDE like reference */}
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

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default USANetworkMapV2;
