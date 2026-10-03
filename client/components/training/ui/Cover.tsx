"use client";

/** Theme shades for covers without an image — picked per title so neighbouring cards differ. */
const FALLBACKS = [
  "from-[#1C4463] to-[#0B1A24]",
  "from-emerald-700 to-[#1C4463]",
  "from-[#25587f] to-emerald-800",
  "from-slate-700 to-[#1C4463]",
  "from-emerald-800 to-slate-900",
];

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Card cover: the record's own image, or a theme gradient with its initials.
 * Never borrows another card's photo, so no two cards share a picture.
 */
export default function Cover({ src, label, className = "" }: { src?: string; label: string; className?: string }) {
  if (src) return <img src={src} alt="" className={`w-full h-full object-cover ${className}`} />;
  const initials = label.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className={`w-full h-full bg-gradient-to-br ${FALLBACKS[hash(label) % FALLBACKS.length]} flex items-center justify-center ${className}`}>
      <span className="text-white/90 font-extrabold text-2xl tracking-wide">{initials || "•"}</span>
    </div>
  );
}
