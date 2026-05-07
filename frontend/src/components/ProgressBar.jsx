export default function ProgressBar({ pct = 0, className = '' }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? 'bg-green-500' : clamped >= 50 ? 'bg-blue-500' : 'bg-amber-400';
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
