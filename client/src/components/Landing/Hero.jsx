import React from "react";
import { Link } from "react-router";

// A worked example of how each format prices the same kind of bids
const examples = [
  {
    name: "English",
    line: "Asha's limit is Rs 9,000. Rohan bids Rs 6,000.",
    result: "Asha leads at Rs 6,100",
    bar: "bg-brand-600",
    width: "w-3/4",
  },
  {
    name: "Dutch",
    line: "Opens at Rs 18,000 and drops Rs 150 a minute.",
    result: "First to accept wins",
    bar: "bg-amber-500",
    width: "w-1/2",
  },
  {
    name: "Sealed",
    line: "Hidden bids of Rs 9,000 and Rs 6,500.",
    result: "Winner pays Rs 6,500",
    bar: "bg-gray-900",
    width: "w-2/3",
  },
];

export const Hero = () => {
  return (
    <section className="bg-brand-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-amber-400 text-sm font-semibold mb-4">
            बोली &middot; boli &middot; the bid
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.05] mb-6">
            One auction house. Three ways to sell.
          </h1>
          <p className="text-lg text-brand-100 mb-10 max-w-lg leading-relaxed">
            Let the price climb in the open, fall until someone blinks, or stay
            sealed until the hammer. You pick the format for each item.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center bg-amber-400 text-gray-900 px-8 py-3.5 rounded-xl hover:bg-amber-300 active:scale-[0.97] transition-all font-semibold"
            >
              Create an account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center border border-white/25 text-white px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all font-semibold"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="bg-white text-gray-900 rounded-2xl p-6 sm:p-7 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">
            How each format sets the price
          </p>
          <ul className="space-y-5">
            {examples.map((ex) => (
              <li key={ex.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{ex.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-right">
                    {ex.result}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{ex.line}</p>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${ex.bar} ${ex.width}`} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
