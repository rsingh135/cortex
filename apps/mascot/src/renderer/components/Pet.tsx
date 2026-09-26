import { useEffect, useRef } from 'react';
import type { PetState, Reaction } from '../lib/store';
import brain from '../assets/brain-3d.png';
import { cursorTilt } from '../lib/cursor';

export function Pet({ state, reaction }: { state: PetState; reaction: Reaction }) {
  const host = useRef<HTMLDivElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    const image = portrait.current!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, frame = 0, previous = 0;
    const track = (x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      target = cursorTilt(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2);
    };
    const move = (event: PointerEvent) => track(event.clientX, event.clientY);
    const reset = () => { target = { x: 0, y: 0 }; };
    const unsubscribe = window.mascot?.onCursor?.(point => track(point.x, point.y));
    window.addEventListener('pointermove', move);
    document.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    const animate = (ms: number) => {
      const step = 1 - Math.exp(-Math.min((ms - previous) / 1000, .05) * 8); previous = ms;
      current.x += ((motion.matches ? 0 : target.x) - current.x) * step;
      current.y += ((motion.matches ? 0 : target.y) - current.y) * step;
      image.style.transform = `perspective(500px) rotateY(${current.x}deg) rotateX(${-current.y}deg) translate(${current.x / 4}px, ${current.y / 5}px)`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); unsubscribe?.(); window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', reset); window.removeEventListener('blur', reset); };
  }, []);
  const animation = state === 'reacting' ? `pet-reacting-${reaction}` : `pet-${state}`;
  return <div ref={host} className={`brain cortex-portrait ${animation}`}>
    <div ref={portrait} className="cortex-tilt"><img className="brain-body" src={brain} width="120" height="120" draggable={false} alt={`Cortex, pink brain with glasses and tiny feet, ${state}`}/></div>
    <span className="brain-ground-shadow" aria-hidden="true"/>
    {state === 'listening' && <span className="listening-waves" aria-hidden="true"><i/><i/><i/><i/><i/></span>}
  </div>;
}
