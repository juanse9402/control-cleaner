import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';

export default function HealthChart({ dailyData, refAreasRegla, refAreasPredicted }) {
  if (!dailyData || dailyData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
        
        {/* Highlight menstruation days (behind lines) */}
        {refAreasRegla.map((area, idx) => (
          <ReferenceArea key={`regla-${idx}`} x1={area.start} x2={area.end} y1={0} y2={4} fill="#FFD1DC" fillOpacity={0.5} />
        ))}
        {/* Highlight predicted menstruation days */}
        {refAreasPredicted.map((area, idx) => (
          <ReferenceArea key={`pred-${idx}`} x1={area.start} x2={area.end} y1={0} y2={4} fill="#e5e7eb" fillOpacity={0.6} />
        ))}

        <Legend 
          verticalAlign="bottom" 
          height={36} 
          content={() => (
            <div className="flex justify-center gap-4 text-xs font-medium mt-4 flex-wrap">
              <span className="flex items-center gap-1 text-orange-700">🟠 Naproxeno</span>
              <span className="flex items-center gap-1 text-rose-700">🔴 Imigran</span>
              <span className="flex items-center gap-1 text-pink-500">🌸 Regla</span>
              <span className="flex items-center gap-1 text-gray-500">⚪ Predicción</span>
            </div>
          )} 
        />
        <Line type="monotone" dataKey="Naproxeno" stroke="#f97316" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
        <Line type="monotone" dataKey="Imigran" stroke="#e11d48" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
      </LineChart>
    </ResponsiveContainer>
  );
}
