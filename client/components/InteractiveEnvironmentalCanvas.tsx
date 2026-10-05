"use client";

import { useEffect, useRef } from "react";

export type ThemeMode = "deep" | "light";

interface InteractiveCanvasProps {
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  seed: number;
}

interface ClickRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  alpha: number;
}

export default function InteractiveEnvironmentalCanvas({
  themeMode = "deep",
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse physics state
    const mouse = {
      x: width * 0.5,
      y: height * 0.45,
      targetX: width * 0.5,
      targetY: height * 0.45,
      vx: 0,
      vy: 0,
      prevX: width * 0.5,
      prevY: height * 0.45,
      isActive: false,
    };

    // Particles for aeration / suspended water micro-nodes
    const particleCount = 42;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.3) * 0.4,
        vy: (Math.random() - 0.5) * 0.25,
        radius: 1.2 + Math.random() * 2.2,
        alpha: 0.2 + Math.random() * 0.4,
        baseAlpha: 0.2 + Math.random() * 0.4,
        seed: Math.random() * 100,
      });
    }

    // Ripples spawned on click
    const ripples: ClickRipple[] = [];

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isActive = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
        mouse.isActive = true;
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? width / 2 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? height / 2 : e.clientY;

      ripples.push({
        x: clientX,
        y: clientY,
        radius: 10,
        maxRadius: Math.max(width, height) * 0.45,
        strength: 24,
        alpha: 0.85,
      });

      // Cap active ripples
      if (ripples.length > 6) ripples.shift();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("mousedown", handlePointerDown);

    let time = 0;

    const render = () => {
      time += 0.012;

      // Spring lerp for mouse motion
      mouse.vx = mouse.targetX - mouse.x;
      mouse.vy = mouse.targetY - mouse.y;
      mouse.x += mouse.vx * 0.07;
      mouse.y += mouse.vy * 0.07;

      const isDeep = themeMode === "deep";

      // 1. Base gradient
      const bgGrad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );

      if (isDeep) {
        // Deep Oceanic Navy & Obsidian Black (#1C4463 base)
        bgGrad.addColorStop(0, "#1c4463");
        bgGrad.addColorStop(0.35, "#122f46");
        bgGrad.addColorStop(0.7, "#0b1d2b");
        bgGrad.addColorStop(1, "#050d14");
      } else {
        // Crisp White & Ice Slate combination
        bgGrad.addColorStop(0, "#FFFFFF");
        bgGrad.addColorStop(0.4, "#F0F5F9");
        bgGrad.addColorStop(0.75, "#DFEBF3");
        bgGrad.addColorStop(1, "#CFDFEC");
      }

      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Cursor Ambient Luminescent Pool
      const glowGrad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        340
      );
      if (isDeep) {
        glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.18)");
        glowGrad.addColorStop(0.4, "rgba(28, 68, 99, 0.35)");
        glowGrad.addColorStop(1, "rgba(5, 13, 20, 0)");
      } else {
        glowGrad.addColorStop(0, "rgba(28, 68, 99, 0.18)");
        glowGrad.addColorStop(0.5, "rgba(28, 68, 99, 0.05)");
        glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      }
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // 3. Update & render click shockwaves / ripples
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r];
        rip.radius += 5.5;
        rip.alpha *= 0.965;

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = isDeep
          ? `rgba(255, 255, 255, ${rip.alpha * 0.5})`
          : `rgba(28, 68, 99, ${rip.alpha * 0.35})`;
        ctx.lineWidth = Math.max(1, 3.5 * rip.alpha);
        ctx.stroke();

        if (rip.alpha < 0.02 || rip.radius > rip.maxRadius) {
          ripples.splice(r, 1);
        }
      }

      // 4. Draw Laminar Flow Topographic Streamlines
      const lineCount = 18;
      const verticalStep = (height * 1.15) / lineCount;
      const horizontalStep = 28;

      ctx.lineWidth = 1.25;

      for (let l = 0; l < lineCount; l++) {
        const baseY = l * verticalStep - height * 0.08;

        ctx.beginPath();

        let started = false;

        for (let x = -40; x <= width + 40; x += horizontalStep) {
          // Complex harmonic waves simulating fluid stream currents
          const wave1 = Math.sin(x * 0.0022 + time * 0.7 + l * 0.35) * 26;
          const wave2 = Math.cos(x * 0.0048 - time * 0.45 + l * 0.2) * 14;
          const wave3 = Math.sin((x + baseY) * 0.0015 + time * 0.25) * 8;

          let y = baseY + wave1 + wave2 + wave3;

          // Mouse deflection physics (smooth fluid displacement around cursor)
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mouseRadius = 240;

          if (dist < mouseRadius && dist > 0.001) {
            const factor = (1 - dist / mouseRadius) ** 2;
            const pushY = (dy / dist) * factor * 48;
            const pushX = (dx / dist) * factor * 22;
            x += pushX;
            y += pushY;
          }

          // Click ripple displacement
          for (let r = 0; r < ripples.length; r++) {
            const rip = ripples[r];
            const rdx = x - rip.x;
            const rdy = y - rip.y;
            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
            const distFromCrest = Math.abs(rdist - rip.radius);

            if (distFromCrest < 70) {
              const ripWave =
                Math.sin((rdist - rip.radius) * 0.12) *
                rip.strength *
                rip.alpha *
                (1 - distFromCrest / 70);
              y += ripWave;
            }
          }

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Color grading for lines based on theme and depth
        const proximityToMouse = Math.abs(baseY - mouse.y);
        const mouseHighlight = Math.max(
          0,
          1 - proximityToMouse / (height * 0.35)
        );

        if (isDeep) {
          // Pure white highlights mixed with #1C4463 tones
          const isAccent = l % 3 === 0;
          const alpha = isAccent
            ? 0.25 + mouseHighlight * 0.3
            : 0.12 + mouseHighlight * 0.18;
          const color = isAccent
            ? `rgba(255, 255, 255, ${alpha})`
            : `rgba(180, 215, 245, ${alpha})`;
          ctx.strokeStyle = color;
          ctx.lineWidth = isAccent ? 1.5 : 1;
        } else {
          const isAccent = l % 3 === 0;
          const alpha = isAccent
            ? 0.22 + mouseHighlight * 0.2
            : 0.1 + mouseHighlight * 0.12;
          ctx.strokeStyle = `rgba(28, 68, 99, ${alpha})`;
          ctx.lineWidth = isAccent ? 1.4 : 0.9;
        }

        ctx.stroke();
      }

      // 5. Draw Suspended Aeration Micro-particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move along natural drift
        p.x += p.vx + Math.cos(time * 0.5 + p.seed) * 0.3;
        p.y += p.vy + Math.sin(time * 0.4 + p.seed) * 0.25;

        // Wrap around screen boundaries with margin
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Mouse gentle repulsion
        const pdx = p.x - mouse.x;
        const pdy = p.y - mouse.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < 140 && pdist > 0.001) {
          const force = (1 - pdist / 140) * 1.5;
          p.x += (pdx / pdist) * force;
          p.y += (pdy / pdist) * force;
        }

        // Particle pulse
        const pulse = Math.sin(time * 1.8 + p.seed) * 0.25 + 0.75;
        const curAlpha = p.baseAlpha * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (isDeep) {
          ctx.fillStyle = `rgba(255, 255, 255, ${curAlpha * 0.85})`;
          ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = `rgba(28, 68, 99, ${curAlpha * 0.75})`;
          ctx.shadowColor = "rgba(28, 68, 99, 0.35)";
          ctx.shadowBlur = 4;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mousedown", handlePointerDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [themeMode]);

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Fine-grain tactile film noise overlay to eliminate banding and add physical texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: themeMode === "deep" ? 0.035 : 0.02,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
