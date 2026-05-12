// MigraineChart.jsx — Chart.js registration at module level (NOT inside component)
import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ONCE at module level — this is what prevents the initialization error
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

export default function MigraineChart({ dailyData, refAreasRegla, refAreasPredicted }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!dailyData || dailyData.length === 0 || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = dailyData.map((d) => d.name);
    const naproxenoData = dailyData.map((d) => d.Naproxeno);
    const imigranData = dailyData.map((d) => d.Imigran);

    const reglaSet = new Set();
    (refAreasRegla || []).forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) reglaSet.add(String(d));
    });

    const predictedSet = new Set();
    (refAreasPredicted || []).forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) predictedSet.add(String(d));
    });

    const backgroundPlugin = {
      id: 'backgroundBands',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        const bandwidth = scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0);
        labels.forEach((label, idx) => {
          const xCenter = scales.x.getPixelForValue(idx);
          const xStart = xCenter - bandwidth / 2;
          if (reglaSet.has(label)) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 209, 220, 0.55)';
            ctx.fillRect(xStart, chartArea.top, bandwidth, chartArea.bottom - chartArea.top);
            ctx.restore();
          } else if (predictedSet.has(label)) {
            ctx.save();
            ctx.fillStyle = 'rgba(229, 231, 235, 0.65)';
            ctx.fillRect(xStart, chartArea.top, bandwidth, chartArea.bottom - chartArea.top);
            ctx.restore();
          }
        });
      },
    };

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      plugins: [backgroundPlugin],
      data: {
        labels,
        datasets: [
          {
            label: 'Naproxeno',
            data: naproxenoData,
            borderColor: '#f97316',
            pointBackgroundColor: '#f97316',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Imigran',
            data: imigranData,
            borderColor: '#e11d48',
            pointBackgroundColor: '#e11d48',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { size: 11 }, color: '#6b7280', padding: 12, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#111827',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 8,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af', font: { size: 9 }, maxTicksLimit: 16 },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: '#9ca3af', font: { size: 11 } },
            grid: { color: '#f3f4f6' },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [dailyData, refAreasRegla, refAreasPredicted]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} />
      <div className="flex justify-center gap-4 text-[10px] font-medium mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-orange-600">🟠 Naproxeno (Leve)</span>
        <span className="flex items-center gap-1 text-rose-600">🔴 Imigran (Fuerte)</span>
        <span className="flex items-center gap-1 text-pink-400">🌸 Regla</span>
        <span className="flex items-center gap-1 text-gray-400">⚪ Predicción</span>
      </div>
    </div>
  );
}
