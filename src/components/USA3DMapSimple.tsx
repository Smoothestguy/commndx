import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface USA3DMapSimpleProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  description?: string;
  height?: string;
  className?: string;
  showButton?: boolean;
}

const USA3DMapSimple = ({
  title = "Nationwide",
  subtitle = "On-Demand",
  tagline = "Waste Solutions.",
  description = "Same-Day, Pay-On-Demand, Nationwide",
  height = "600px",
  className,
  showButton = false
}: USA3DMapSimpleProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // USA map outline (simplified coordinates for visual effect)
    const usaOutline = [
      // West Coast
      [120, 80], [110, 100], [100, 150], [95, 200], [100, 250],
      // Southwest
      [150, 270], [200, 280], [250, 270],
      // South
      [300, 280], [350, 290], [400, 300], [450, 310], [500, 300],
      // Southeast
      [550, 290], [580, 270], [600, 250],
      // East Coast
      [620, 220], [630, 180], [635, 140], [630, 100],
      // Northeast
      [620, 80], [600, 70], [580, 75],
      // Great Lakes
      [550, 85], [500, 80], [450, 85], [400, 90],
      // Midwest
      [350, 100], [300, 110], [250, 120], [200, 110], [150, 95], [120, 80]
    ];

    // Major cities (x, y, size, name)
    const cities: [number, number, number, string][] = [
      [115, 90, 4, 'Seattle'],
      [105, 160, 6, 'San Francisco'],
      [110, 210, 7, 'Los Angeles'],
      [180, 240, 5, 'Phoenix'],
      [230, 200, 6, 'Denver'],
      [320, 260, 6, 'Dallas'],
      [340, 280, 6, 'Houston'],
      [380, 170, 7, 'Chicago'],
      [420, 185, 5, 'Detroit'],
      [460, 240, 6, 'Atlanta'],
      [540, 300, 6, 'Miami'],
      [570, 210, 6, 'Washington DC'],
      [590, 190, 5, 'Philadelphia'],
      [610, 170, 8, 'New York'],
      [625, 150, 6, 'Boston'],
    ];

    let animationFrame: number;
    let time = 0;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw USA outline with glow
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00d4ff';
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      
      ctx.beginPath();
      usaOutline.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Draw state-like divisions (simplified)
      ctx.save();
      ctx.strokeStyle = '#0088cc';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      
      // Vertical divisions
      for (let x = 150; x < 600; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 80);
        ctx.lineTo(x + 20, 300);
        ctx.stroke();
      }
      
      // Horizontal divisions
      for (let y = 120; y < 280; y += 60) {
        ctx.beginPath();
        ctx.moveTo(120, y);
        ctx.lineTo(620, y + 20);
        ctx.stroke();
      }
      ctx.restore();

      // Draw connections between cities
      cities.forEach((city, i) => {
        const [x1, y1] = city;
        
        // Connect to nearest 3-4 cities
        cities.forEach((otherCity, j) => {
          if (i >= j) return; // Avoid duplicate lines
          
          const [x2, y2] = otherCity;
          const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          
          if (distance < 200) {
            ctx.save();
            ctx.strokeStyle = '#88ccff';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
          }
        });
      });

      // Draw animated particles
      for (let i = 0; i < 150; i++) {
        const cityIndex = Math.floor((i / 150) * cities.length);
        const city = cities[cityIndex];
        const [cx, cy] = city;
        
        const angle = (time * 0.5 + i * 137.5) % 360;
        const radius = 10 + ((time * 0.3 + i * 5) % 60);
        const px = cx + Math.cos(angle * Math.PI / 180) * radius;
        const py = cy + Math.sin(angle * Math.PI / 180) * radius;
        
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

      // Draw city nodes with STRONG glow
      cities.forEach(city => {
        const [x, y, size] = city;
        
        // Extra large outer glow
        ctx.save();
        const extraGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
        extraGlow.addColorStop(0, 'rgba(255, 180, 70, 0.6)');
        extraGlow.addColorStop(0.3, 'rgba(255, 150, 50, 0.3)');
        extraGlow.addColorStop(1, 'rgba(255, 140, 30, 0)');
        ctx.fillStyle = extraGlow;
        ctx.beginPath();
        ctx.arc(x, y, size * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Large glow
        ctx.save();
        const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
        outerGlow.addColorStop(0, 'rgba(255, 190, 80, 0.9)');
        outerGlow.addColorStop(0.5, 'rgba(255, 160, 60, 0.6)');
        outerGlow.addColorStop(1, 'rgba(255, 140, 40, 0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(x, y, size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Medium glow
        ctx.save();
        const mediumGlow = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        mediumGlow.addColorStop(0, 'rgba(255, 210, 120, 1)');
        mediumGlow.addColorStop(0.6, 'rgba(255, 170, 70, 0.8)');
        mediumGlow.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = mediumGlow;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Core
        ctx.save();
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        coreGradient.addColorStop(0, 'rgba(255, 250, 220, 1)');
        coreGradient.addColorStop(0.5, 'rgba(255, 200, 100, 1)');
        coreGradient.addColorStop(1, 'rgba(255, 160, 60, 1)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Bright center
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        className
      )}
      style={{ height }}
    >
      {/* Background with stars and gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Stars background */}
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

      {/* Canvas with 3D perspective transform */}
      <div className="absolute inset-0 flex items-center justify-end pr-8">
        <div
          style={{
            transform: 'perspective(1200px) rotateX(25deg) rotateY(-15deg) rotateZ(2deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-[700px] h-[400px]"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(0, 180, 255, 0.3))',
            }}
          />
        </div>
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

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default USA3DMapSimple;
