import { useState } from "react";
import { formatRs } from "../utils/auction.js";

const WIDTH = 600;
const HEIGHT = 170;
const PAD = { top: 16, right: 16, bottom: 22, left: 58 };

// Price over time as a step line: the price holds until the next bid lands
export const PriceChart = ({ bids }) => {
  const [hover, setHover] = useState(null);

  const points = [...bids]
    .map((b) => ({
      time: new Date(b.bidTime).getTime(),
      amount: b.bidAmount,
      name: b.bidder?.name,
    }))
    .sort((a, b) => a.time - b.time || a.amount - b.amount);

  if (points.length < 2) return null;

  const times = points.map((p) => p.time);
  const amounts = points.map((p) => p.amount);
  const minT = Math.min(...times);
  const spanT = Math.max(...times) - minT || 1;
  const minA = Math.min(...amounts);
  const maxA = Math.max(...amounts);
  const spanA = maxA - minA || 1;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t) => PAD.left + ((t - minT) / spanT) * plotW;
  const y = (a) => PAD.top + (1 - (a - minA) / spanA) * plotH;

  const path = points
    .map((p, i) =>
      i === 0
        ? `M ${x(p.time)} ${y(p.amount)}`
        : `H ${x(p.time)} V ${y(p.amount)}`,
    )
    .join(" ");

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.time) - svgX) < Math.abs(x(points[nearest].time) - svgX)) {
        nearest = i;
      }
    });
    setHover(nearest);
  };

  const active = hover != null ? points[hover] : null;
  const last = points[points.length - 1];
  const axisStyle = { fontSize: 11, fill: "#9ca3af" };
  const shortTime = (t) =>
    new Date(t).toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Price rose from ${formatRs(points[0].amount)} to ${formatRs(last.amount)} over ${points.length} bids`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {[minA, maxA].map((a) => (
          <g key={a}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(a)}
              y2={y(a)}
              stroke="#f3f4f6"
            />
            <text x={PAD.left - 8} y={y(a) + 4} textAnchor="end" style={axisStyle}>
              {a.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} style={axisStyle}>
          {shortTime(minT)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" style={axisStyle}>
          {shortTime(last.time)}
        </text>

        <path
          d={path}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle
          cx={x(last.time)}
          cy={y(last.amount)}
          r="4.5"
          fill="var(--color-brand-600)"
          stroke="white"
          strokeWidth="2"
        />

        {active && (
          <>
            <line
              x1={x(active.time)}
              x2={x(active.time)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="#d1d5db"
            />
            <circle
              cx={x(active.time)}
              cy={y(active.amount)}
              r="4.5"
              fill="var(--color-brand-600)"
              stroke="white"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {active && (
        <div
          className="absolute top-0 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap"
          style={{
            left: `${(x(active.time) / WIDTH) * 100}%`,
            transform: `translateX(${x(active.time) > WIDTH / 2 ? "-105%" : "5%"})`,
          }}
        >
          <span className="font-semibold tabular-nums">
            {formatRs(active.amount)}
          </span>
          {active.name && <span className="text-gray-300"> &middot; {active.name}</span>}
        </div>
      )}
    </div>
  );
};
