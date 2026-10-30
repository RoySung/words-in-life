import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StartupView } from './StartupView';

/** Turn the loading camera over to reveal the mounted, live homepage. */
export function StartupTransition({ ready, phase = 'library', failed = false, children }: {
  ready: boolean; phase?: 'boot' | 'library'; failed?: boolean; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [complete, setComplete] = useState(false);

  useLayoutEffect(() => {
    if (!ready || complete || failed) return;
    const container = root.current!;
    const home = container.querySelector<HTMLElement>('.startup-transition-home')!;
    const overlay = container.querySelector<HTMLElement>('.startup-transition-overlay')!;
    const front = overlay.querySelector<HTMLElement>('.startup-camera');
    const back = home.querySelector<HTMLElement>('.camera-body');
    const utility = home.querySelector<HTMLElement>('.camera-utility');
    const light = container.querySelector<HTMLElement>('.startup-transition-light')!;
    const shadow = container.querySelector<HTMLElement>('.startup-transition-shadow')!;
    if (!front || !back || !front.animate) { setComplete(true); return; }

    const animations: Animation[] = [];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    const finish = () => { if (!disposed) setComplete(true); };
    const animate = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, { fill: 'both', ...options });
      animations.push(animation);
      return animation.finished;
    };
    const showHome = () => {
      overlay.style.visibility = 'hidden';
      home.style.visibility = 'visible';
    };
    const onMotionChange = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', onMotionChange);
    window.addEventListener('resize', finish);

    void (async () => {
      if (!motion.matches) {
        // Wait only for the remaining paper-feed animation, including when data loads quickly.
        const feed = overlay.querySelector('.startup-print')?.getAnimations()
          .find(animation => 'animationName' in animation && animation.animationName === 'startup-print-feed');
        if (feed) await feed.finished;
        if (disposed) return;
      }
      void animate(light, [{ opacity: 1 }, { opacity: 0 }], { duration: motion.matches ? 120 : 720 }).catch(() => {});
      if (motion.matches) {
        showHome();
        await animate(home, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
      } else {
        const source = front.getBoundingClientRect();
        const target = back.getBoundingClientRect();
        const dx = target.x + target.width / 2 - source.x - source.width / 2;
        const dy = target.y + target.height / 2 - source.y - source.height / 2;
        const sourceShadow = overlay.querySelector<HTMLElement>('.startup-shadow')!;
        const shadowBounds = sourceShadow.getBoundingClientRect();
        shadow.style.left = `${shadowBounds.x}px`;
        shadow.style.top = `${shadowBounds.y}px`;
        shadow.style.width = `${shadowBounds.width}px`;
        const shadowX = target.x + target.width / 2 - shadowBounds.x - shadowBounds.width / 2;
        const shadowY = target.bottom - shadowBounds.y - shadowBounds.height / 2;
        void animate(shadow, [
          { transform: 'translate(0, 0) scaleX(1)', opacity: .6 },
          { transform: `translate(${shadowX}px, ${shadowY * .5}px) scaleX(.23)`, opacity: .35, offset: .45 },
          { transform: `translate(${shadowX}px, ${shadowY}px) scaleX(${target.width / shadowBounds.width * .85})`, opacity: .35 },
        ], { duration: 720, easing: 'ease-in-out' }).catch(() => {});
        void animate(sourceShadow, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(.23)', opacity: .35 }], { duration: 320 }).catch(() => {});
        overlay.querySelectorAll<HTMLElement>('.startup-brand, .startup-print, .startup-status, .startup-footer')
          .forEach(element => { void animate(element, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).catch(() => {}); });
        await animate(front, [
          { transform: 'perspective(1100px) translate(0, 0) rotateY(0deg) scale(1)' },
          { transform: `perspective(1100px) translate(${dx}px, ${dy}px) rotateY(-90deg) scale(1.42)` },
        ], { duration: 320, easing: 'cubic-bezier(.45,0,.8,.55)' });
        if (disposed) return;
        // Start the real homepage edge-on before exposing it; never clone its controls or video.
        const reveal = animate(back, [
          { transform: 'perspective(1100px) rotateY(90deg) scale(.72)' },
          { transform: 'perspective(1100px) rotateY(0deg) scale(1)' },
        ], { duration: 400, easing: 'cubic-bezier(.15,.65,.25,1)' });
        if (utility) void animate(utility, [{ opacity: 0 }, { opacity: 1 }], { delay: 260, duration: 140 }).catch(() => {});
        shadow.style.visibility = 'visible';
        showHome();
        await reveal;
      }
      finish();
    })().catch(finish);

    return () => {
      disposed = true;
      animations.forEach(animation => animation.cancel());
      home.style.visibility = '';
      overlay.style.visibility = '';
      motion.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', finish);
    };
  }, [ready, complete, failed]);

  const exposed = complete || failed;
  return <div ref={root} className="vs-theme startup-transition">
    {!exposed && <><div className="startup-transition-light" aria-hidden="true" /><div className="startup-transition-shadow" aria-hidden="true" /></>}
    <div className="startup-transition-home" data-entering={!exposed} inert={!exposed} aria-hidden={!exposed ? true : undefined}>
      {children}
    </div>
    {!exposed && <div className="startup-transition-overlay" inert={ready} aria-hidden={ready ? true : undefined}>
      <StartupView phase={phase} />
    </div>}
  </div>;
}
