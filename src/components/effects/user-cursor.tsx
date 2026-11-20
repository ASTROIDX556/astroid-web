'use client';

import * as React from 'react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
} from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
  type SpringOptions,
} from 'framer-motion';

// ---------------------------------------------------------------------------
// Cursor Context — allows any component / section to set the label text
// ---------------------------------------------------------------------------

type CursorContextValue = {
  label: string;
  setLabel: (label: string) => void;
  color: string;
  setColor: (color: string) => void;
  textColor: string;
  setTextColor: (color: string) => void;
};

const CursorContext = createContext<CursorContextValue>({
  label: 'Explore',
  setLabel: () => {},
  color: '#FFFFFF',
  setColor: () => {},
  textColor: '#000000',
  setTextColor: () => {},
});

export const useCursor = () => useContext(CursorContext);

// ---------------------------------------------------------------------------
// CursorZone — wrap a section to change cursor label on hover
// ---------------------------------------------------------------------------

export function CursorZone({
  label,
  color,
  textColor,
  children,
  className,
  style,
  ...rest
}: {
  label: string;
  color?: string;
  textColor?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useCursor();

  const onEnter = useCallback(() => {
    ctx.setLabel(label);
    if (color) ctx.setColor(color);
    if (textColor) ctx.setTextColor(textColor);
  }, [label, color, textColor, ctx]);

  const onLeave = useCallback(() => {
    if (ctx.label === label) {
      ctx.setLabel('');
      ctx.setColor('#FFFFFF');
      ctx.setTextColor('#000000');
    }
  }, [ctx, label]);

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={className}
      style={style}
      data-cursor-label={label}
      data-cursor-color={color}
      data-cursor-textcolor={textColor}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CursorLayer — the floating arrow + label pill
// ---------------------------------------------------------------------------

function CursorLayer({
  layerStyle,
  visible,
  arrowX,
  arrowY,
  labelX,
  labelY,
  labelRotation,
  scale,
  showLabel,
  size,
  arrowContent,
  labelContent,
}: {
  layerStyle: React.CSSProperties;
  visible: boolean;
  arrowX: any;
  arrowY: any;
  labelX: any;
  labelY: any;
  labelRotation: any;
  scale: any;
  showLabel: boolean;
  size: number;
  arrowContent: React.ReactNode;
  labelContent: React.ReactNode;
}) {
  return (
    <div style={layerStyle}>
      {showLabel && (
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            x: labelX,
            y: labelY,
            rotate: labelRotation,
            scale,
            background: 'var(--cursor-color, #FFFFFF)',
            border: '1.5px solid var(--cursor-color, #FFFFFF)',
            borderRadius: 999,
            padding: `${size * 0.18}px ${size * 0.36}px`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
            opacity: visible ? 1 : 0,
            transformOrigin: '0% 50%',
            transition:
              'opacity 140ms ease, background 300ms ease, border-color 300ms ease',
            willChange: 'transform, opacity',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {labelContent}
        </motion.div>
      )}

      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          x: arrowX,
          y: arrowY,
          scale,
          width: size,
          height: size,
          opacity: visible ? 1 : 0,
          transformOrigin: '0% 0%',
          transition: 'opacity 140ms ease',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: size, height: size }}>{arrowContent}</div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserCursor — the full-page cursor overlay
// ---------------------------------------------------------------------------

const CURSOR_DEFAULTS = {
  color: '#FFFFFF',
  size: 31,
  pressScale: 0.92,
  offsetX: 0,
  offsetY: 0,
  showLabel: true,
  name: 'Explore',
  textColor: '#000000',
  labelTiltStrength: 25,
  labelOffsetUseDefault: true,
  labelOffsetX: 25,
  labelOffsetY: 12,
};

function parseRGB(colorStr: string): { r: number; g: number; b: number } | null {
  if (!colorStr) return null;
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]!), g: parseInt(m[2]!), b: parseInt(m[3]!) };
  }
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  return null;
}

function getContrastColor(bgColorStr: string): string {
  const rgb = parseRGB(bgColorStr);
  if (!rgb) return '#000000';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function isImportantElement(el: HTMLElement | null): boolean {
  if (!el) return false;

  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && depth < 5 && current !== document.documentElement) {
    const tagName = current.tagName.toUpperCase();

    if (
      tagName === 'BUTTON' ||
      tagName === 'A' ||
      tagName === 'INPUT' ||
      tagName === 'SELECT' ||
      tagName === 'TEXTAREA'
    ) {
      return true;
    }

    if (tagName.startsWith('H') && tagName.length === 2 && !isNaN(Number(tagName[1]))) {
      return true;
    }

    if (
      current.getAttribute('role') === 'button' ||
      current.getAttribute('data-cursor-target') === 'true'
    ) {
      return true;
    }

    const className = current.className || '';
    if (typeof className === 'string') {
      const lowerClass = className.toLowerCase();
      if (
        lowerClass.includes('card') ||
        lowerClass.includes('button') ||
        lowerClass.includes('nav') ||
        lowerClass.includes('logo') ||
        lowerClass.includes('feature') ||
        lowerClass.includes('step') ||
        lowerClass.includes('interactive') ||
        lowerClass.includes('glow')
      ) {
        return true;
      }
    }

    const style = window.getComputedStyle(current);
    if (style.cursor === 'pointer') {
      return true;
    }

    current = current.parentElement;
    depth++;
  }
  return false;
}

function isStandardNeutral(rgb: { r: number; g: number; b: number }): boolean {
  const threshold = 15;
  const diff1 = Math.abs(rgb.r - rgb.g);
  const diff2 = Math.abs(rgb.g - rgb.b);
  const diff3 = Math.abs(rgb.r - rgb.b);
  return diff1 < threshold && diff2 < threshold && diff3 < threshold;
}

function getChameleonColors(el: HTMLElement | null) {
  const defaultColors = { bg: '#FFFFFF', text: '#000000', border: '#FFFFFF' };
  if (!el || typeof window === 'undefined') return defaultColors;

  const isTransparent = (color: string) => {
    return (
      !color ||
      color === 'transparent' ||
      color === 'rgba(0, 0, 0, 0)' ||
      color === 'rgba(0,0,0,0)'
    );
  };

  let bgColor = 'transparent';
  let textColor = 'transparent';

  // 1. Direct inspection of the hovered element itself
  if (el.hasAttribute('data-cursor-color')) {
    bgColor = el.getAttribute('data-cursor-color') || 'transparent';
    textColor = el.getAttribute('data-cursor-textcolor') || 'transparent';
  }

  // If no custom attribute, check computed styles
  if (isTransparent(bgColor)) {
    const elStyle = window.getComputedStyle(el);
    const elBg = elStyle.backgroundColor;

    // Use background color if it is not transparent (even if neutral)
    if (!isTransparent(elBg)) {
      bgColor = elBg;
    } else {
      // If the background is transparent, check if the element has vibrant text or border color
      const elColor = elStyle.color;
      const elBorderColor = elStyle.borderColor;

      const rgbColor = parseRGB(elColor);
      if (rgbColor && !isStandardNeutral(rgbColor)) {
        bgColor = elColor;
      } else {
        const rgbBorder = parseRGB(elBorderColor);
        if (rgbBorder && !isStandardNeutral(rgbBorder)) {
          bgColor = elBorderColor;
        }
      }
    }
  }

  // 2. Traversal fallback: walk up the DOM to find any parent container background or CursorZone
  if (isTransparent(bgColor)) {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== document.documentElement) {
      if (current.hasAttribute('data-cursor-color')) {
        const attrColor = current.getAttribute('data-cursor-color');
        if (attrColor && !isTransparent(attrColor)) {
          bgColor = attrColor;
          textColor = current.getAttribute('data-cursor-textcolor') || 'transparent';
          break;
        }
      }

      const style = window.getComputedStyle(current);
      const bg = style.backgroundColor;
      if (!isTransparent(bg)) {
        bgColor = bg;
        break;
      }
      current = current.parentElement;
    }
  }

  // 3. Final default fallback (body background)
  if (isTransparent(bgColor)) {
    const bodyStyle = window.getComputedStyle(document.body);
    const bodyBg = bodyStyle.backgroundColor;
    bgColor = !isTransparent(bodyBg) ? bodyBg : '#0A0A0A';
  }

  // Determine contrasting text color for readability
  let contrastText = textColor;
  if (isTransparent(contrastText)) {
    contrastText = getContrastColor(bgColor);
  }

  return { bg: bgColor, text: contrastText, border: bgColor };
}

function UserCursorInner({ name }: { name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = CURSOR_DEFAULTS.size;
  const pressScale = CURSOR_DEFAULTS.pressScale;
  const labelTiltStrength = CURSOR_DEFAULTS.labelTiltStrength;

  const [isOverImportant, setIsOverImportant] = useState(false);
  const isOverImportantRef = useRef(false);
  const showLabel = CURSOR_DEFAULTS.showLabel && !!name && isOverImportant;

  // --- touch detection ---
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(pointer: coarse)');
    const sync = () => setIsTouchDevice(!!mql.matches);
    sync();
    if (mql.addEventListener) {
      mql.addEventListener('change', sync);
      return () => mql.removeEventListener('change', sync);
    }
  }, []);

  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const arrowSpring = useMemo<SpringOptions>(
    () => ({ stiffness: 380, damping: 32, mass: 0.6 }),
    [],
  );
  const labelSpringCfg = useMemo<SpringOptions>(
    () => ({ stiffness: 220, damping: 26, mass: 0.7 }),
    [],
  );

  const resolvedLabelOffset = useMemo(
    () => ({ x: size * 0.9, y: size * 0.2 + 6 }),
    [size],
  );

  // --- motion values ---
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const arrowX = useSpring(mouseX, arrowSpring);
  const arrowY = useSpring(mouseY, arrowSpring);
  const labelXRaw = useSpring(mouseX, labelSpringCfg);
  const labelYRaw = useSpring(mouseY, labelSpringCfg);

  const scaleMV = useMotionValue(1);
  useEffect(() => {
    const controls = animate(scaleMV, pressed ? pressScale : 1, {
      type: 'spring',
      stiffness: 500,
      damping: 28,
      mass: 0.5,
    });
    return () => controls.stop();
  }, [pressed, pressScale, scaleMV]);

  const labelTiltTarget = useMotionValue(0);
  const labelRotation = useSpring(labelTiltTarget, {
    stiffness: 200,
    damping: 24,
    mass: 0.6,
  });

  // --- pointer listeners (full-page) ---
  const lastSampleRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (isTouchDevice || typeof window === 'undefined') return;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = lastSampleRef.current;
      let vx = 0;
      if (last) {
        const dt = Math.max(1, now - last.t);
        vx = ((x - last.x) / dt) * 1000;
        const vy = ((y - last.y) / dt) * 1000;
        const speed = Math.hypot(vx, vy);
        const norm = Math.min(1, speed / 1500);
        const sign = vx === 0 ? 0 : vx > 0 ? 1 : -1;
        labelTiltTarget.set(sign * norm * labelTiltStrength);
      }
      lastSampleRef.current = { x, y, t: now };

      mouseX.set(x);
      mouseY.set(y);
      setHovering(true);

      if (containerRef.current) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        if (el) {
          const colors = getChameleonColors(el);
          const isImportant = isImportantElement(el);
          if (isImportant !== isOverImportantRef.current) {
            isOverImportantRef.current = isImportant;
            setIsOverImportant(isImportant);
          }

          containerRef.current.style.setProperty('--cursor-color', colors.bg);
          containerRef.current.style.setProperty('--cursor-text-color', colors.text);
          containerRef.current.style.setProperty(
            '--cursor-border-color',
            colors.border,
          );
        } else {
          if (isOverImportantRef.current) {
            isOverImportantRef.current = false;
            setIsOverImportant(false);
          }
        }
      }
    };

    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onLeave = () => {
      setHovering(false);
      lastSampleRef.current = null;
      labelTiltTarget.set(0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      setPressed(false);
    };
  }, [isTouchDevice, labelTiltStrength, mouseX, mouseY, labelTiltTarget]);

  const visible = useMemo(() => {
    if (isTouchDevice) return false;
    return hovering;
  }, [isTouchDevice, hovering]);

  const labelTranslateX = useTransform(labelXRaw, (v) => v + resolvedLabelOffset.x);
  const labelTranslateY = useTransform(labelYRaw, (v) => v + resolvedLabelOffset.y);

  const arrowContent = useMemo(
    () => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path
          d="M5 3 L23 14 L14 16 L11 24 Z"
          fill="var(--cursor-color, #FFFFFF)"
          stroke="var(--cursor-text-color, #000000)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>
    ),
    [size],
  );

  const labelContent = useMemo(
    () => (
      <div
        style={{
          color: 'var(--cursor-text-color, #000000)',
          fontSize: Math.max(7, size * 0.43),
          lineHeight: 1.1,
          fontWeight: 600,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          whiteSpace: 'nowrap',
          letterSpacing: 0.1,
          transition: 'color 300ms ease',
        }}
      >
        {name}
      </div>
    ),
    [name, size],
  );

  if (isTouchDevice) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99999,
        cursor: 'none',
      }}
    >
      <CursorLayer
        layerStyle={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
        visible={visible}
        arrowX={arrowX}
        arrowY={arrowY}
        labelX={labelTranslateX}
        labelY={labelTranslateY}
        labelRotation={labelRotation}
        scale={scaleMV}
        showLabel={showLabel}
        size={size}
        arrowContent={arrowContent}
        labelContent={labelContent}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CursorProvider — wraps the entire app, provides context + renders the cursor
// ---------------------------------------------------------------------------

export function CursorProvider({
  children,
  defaultLabel = '',
}: {
  children: React.ReactNode;
  defaultLabel?: string;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [color, setColor] = useState('#FFFFFF');
  const [textColor, setTextColor] = useState('#000000');

  const value = useMemo(
    () => ({ label, setLabel, color, setColor, textColor, setTextColor }),
    [label, color, textColor],
  );

  return (
    <CursorContext.Provider value={value}>
      {/* Hide native cursor globally */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        *, *::before, *::after {
          cursor: none !important;
        }
      `,
        }}
      />
      <UserCursorInner name={label} />
      {children}
    </CursorContext.Provider>
  );
}

export default CursorProvider;
