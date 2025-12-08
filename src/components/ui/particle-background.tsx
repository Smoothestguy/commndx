import { useMemo } from "react";

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  className?: string;
}

export function ParticleBackground({ 
  particleCount = 60, 
  className = "" 
}: ParticleBackgroundProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * -30,
      driftX: (Math.random() - 0.5) * 100,
    }));
  }, [particleCount]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary/60 animate-particle-float"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / 0.4), 0 0 ${particle.size * 4}px hsl(var(--primary) / 0.2)`,
            ["--drift-x" as string]: `${particle.driftX}px`,
          }}
        />
      ))}
    </div>
  );
}
