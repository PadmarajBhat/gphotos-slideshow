import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  size?: number;
  label?: string;
  /** Extra classes, e.g. to size the code from its container instead of `size`. */
  className?: string;
}

/**
 * Renders a QR as inline SVG. A phone camera is the only practical way to get
 * a long Google settings URL onto a TV that has no keyboard.
 */
export const QrCode: React.FC<QrCodeProps> = ({ value, size = 180, label, className = '' }) => {
  const path = useMemo(() => {
    // Type 0 lets the library pick the smallest version that fits.
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const segments: string[] = [];

    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) {
          segments.push(`M${col} ${row}h1v1h-1z`);
        }
      }
    }

    return { d: segments.join(''), count };
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-1 -1 ${path.count + 2} ${path.count + 2}`}
      role="img"
      aria-label={label ?? 'QR code'}
      className={`rounded-xl bg-white p-1 shadow-lg ${className}`}
      shapeRendering="crispEdges"
    >
      <rect x={-1} y={-1} width={path.count + 2} height={path.count + 2} fill="#ffffff" />
      <path d={path.d} fill="#020617" />
    </svg>
  );
};
