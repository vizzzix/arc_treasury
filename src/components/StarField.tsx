import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  depth: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
}

interface ShootingStar {
  x: number;
  y: number;
  speed: number;
  angle: number;
  life: number;
  maxLife: number;
  trail: TrailPoint[];
  trailLength: number;
}

export const StarField = ({ count = 150 }: { count?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const lastShootRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const initStars = () => {
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        depth: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.003 + 0.0008,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX - window.innerWidth / 2),
        y: (e.clientY - window.innerHeight / 2),
      };
    };

    const spawnShootingStar = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.6;

      shootingStarsRef.current.push({
        x,
        y,
        speed: Math.random() * 1.5 + 1,
        angle: Math.PI * 0.3 + Math.random() * 0.2,
        life: 0,
        maxLife: Math.random() * 120 + 80,
        trail: [],
        trailLength: Math.random() * 30 + 20,
      });
    };

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Smooth mouse interpolation (lerp)
      smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.03;
      smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.03;
      const smx = smoothMouseRef.current.x * 0.008;
      const smy = smoothMouseRef.current.y * 0.008;

      // Stars
      for (const star of starsRef.current) {
        const drawX = star.x + smx * star.depth;
        const drawY = star.y + smy * star.depth;
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle;

        ctx.beginPath();
        ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      // Shooting stars — spawn every 5-10 seconds
      if (time - lastShootRef.current > (Math.random() * 5000 + 5000)) {
        spawnShootingStar();
        lastShootRef.current = time;
      }

      // Render shooting stars with trail
      shootingStarsRef.current = shootingStarsRef.current.filter(s => {
        s.life++;
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;

        // Add current position to trail
        const fadeIn = Math.min(s.life / 15, 1);
        const fadeOut = Math.max(1 - s.life / s.maxLife, 0);
        const headOpacity = fadeIn * fadeOut;

        s.trail.push({ x: s.x, y: s.y, opacity: headOpacity });
        if (s.trail.length > s.trailLength) s.trail.shift();

        if (headOpacity <= 0 && s.life > 15) return false;

        // Draw trail as fading curve
        if (s.trail.length > 1) {
          for (let i = 1; i < s.trail.length; i++) {
            const prev = s.trail[i - 1];
            const curr = s.trail[i];
            const progress = i / s.trail.length;
            const trailAlpha = progress * curr.opacity * 0.6;

            if (trailAlpha <= 0) continue;

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = `rgba(200, 220, 255, ${trailAlpha})`;
            ctx.lineWidth = progress * 1.5;
            ctx.stroke();
          }
        }

        // Bright head glow
        if (headOpacity > 0) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${headOpacity})`;
          ctx.fill();

          // Soft glow around head
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 255, ${headOpacity * 0.2})`;
          ctx.fill();
        }

        return true;
      });

      animationId = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    />
  );
};
