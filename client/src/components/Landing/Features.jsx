import React from "react";
import { FaBalanceScale, FaBell, FaRobot, FaStopwatch } from "react-icons/fa";

const features = [
  {
    icon: <FaRobot className="text-lg text-brand-600" />,
    title: "Auto-bid up to your limit",
    desc: "Tell Boli the most you would pay. It bids one step at a time, only when someone passes you, and your limit stays private.",
  },
  {
    icon: <FaStopwatch className="text-lg text-amber-600" />,
    title: "No last-second sniping",
    desc: "A bid in the final two minutes adds time to the clock, so everyone gets a real chance to answer it.",
  },
  {
    icon: <FaBalanceScale className="text-lg text-rose-600" />,
    title: "Fair Play monitoring",
    desc: "Bidding patterns that look like shill bidding are flagged for an admin to review.",
  },
  {
    icon: <FaBell className="text-lg text-sky-600" />,
    title: "Results without refreshing",
    desc: "Auctions close on time by themselves. You hear about outbids, wins and closing lots as they happen.",
  },
];

export const Features = () => {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-12 max-w-xl">
          Built so the best bid actually wins
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-stone-100 flex items-center justify-center">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
