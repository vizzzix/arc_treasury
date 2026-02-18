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

const isMobile = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

export const StarField = ({ count = 150 }: { count?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothMouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const lastShootRef = useRef(0);
  const mobileRef = useRef(isMobile());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mobile = mobileRef.current;
    const starCount = mobile ? 80 : count;
    let animationId: number;
    let frameSkip = 0;

    const initStars = () => {
      starsRef.current = Array.from({ length: starCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        depth: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.003 + 0.0008,
        twinkleOffset: Math.random() * Math.PI * 2,
      }));
    };

    let lastWidth = 0;

    const resize = () => {
      const newWidth = window.innerWidth;
      canvas.width = newWidth;
      canvas.height = window.innerHeight;

      // On mobile, only reinit stars if WIDTH changed (not height)
      // Height changes constantly due to address bar show/hide
      if (!mobile || lastWidth !== newWidth || starsRef.current.length === 0) {
        initStars();
      }
      lastWidth = newWidth;
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
      // Mobile: throttle to ~30fps
      if (mobile) {
        frameSkip++;
        if (frameSkip % 2 !== 0) {
          animationId = requestAnimationFrame(render);
          return;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Parallax (desktop only)
      let smx = 0;
      let smy = 0;
      if (!mobile) {
        smoothMouseRef.current.x += (mouseRef.current.x - smoothMouseRef.current.x) * 0.03;
        smoothMouseRef.current.y += (mouseRef.current.y - smoothMouseRef.current.y) * 0.03;
        smx = smoothMouseRef.current.x * 0.008;
        smy = smoothMouseRef.current.y * 0.008;
      }

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

      // Shooting stars (desktop only)
      if (!mobile) {
        if (time - lastShootRef.current > (Math.random() * 5000 + 5000)) {
          spawnShootingStar();
          lastShootRef.current = time;
        }

        shootingStarsRef.current = shootingStarsRef.current.filter(s => {
          s.life++;
          s.x += Math.cos(s.angle) * s.speed;
          s.y += Math.sin(s.angle) * s.speed;

          const fadeIn = Math.min(s.life / 15, 1);
          const fadeOut = Math.max(1 - s.life / s.maxLife, 0);
          const headOpacity = fadeIn * fadeOut;

          s.trail.push({ x: s.x, y: s.y, opacity: headOpacity });
          if (s.trail.length > s.trailLength) s.trail.shift();

          if (headOpacity <= 0 && s.life > 15) return false;

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

          if (headOpacity > 0) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${headOpacity})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 255, ${headOpacity * 0.2})`;
            ctx.fill();
          }

          return true;
        });
      }

      animationId = requestAnimationFrame(render);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        animationId = requestAnimationFrame(render);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!mobile) window.addEventListener('mousemove', onMouseMove);
    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (!mobile) window.removeEventListener('mousemove', onMouseMove);
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
