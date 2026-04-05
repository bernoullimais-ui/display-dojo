import React, { useState, useEffect } from 'react';

export default function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-[1.5vw]">
      <span className="text-[3vmin] font-black tracking-tighter text-white drop-shadow-md leading-none">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="text-[1.5vmin] font-bold uppercase tracking-[0.2em] text-zinc-400">
        {time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')}
      </span>
    </div>
  );
}
