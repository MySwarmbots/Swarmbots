export const CHART_COLORS = ["#00FF66", "#FF3B30", "#FFCC00", "#002FA7", "#FFFFFF"];

export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111111] border border-[#333333] p-2">
      <p className="font-mono text-[10px] text-[#8A8A8A]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="font-mono text-xs" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
};
