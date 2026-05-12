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
  Filler,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
);

export default function MigraineChart({ dailyData, refAreasRegla, refAreasPredicted }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!dailyData || dailyData.length === 0 || !canvasRef.current) return;

    // Destroy previous chart instance to avoid canvas reuse error
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = dailyData.map((d) => d.name);
    const naproxenoData = dailyData.map((d) => d.Naproxeno);
    const imigranData = dailyData.map((d) => d.Imigran);

    // Build background colors for each day (pink for regla, light gray for predicted, transparent otherwise)
    const reglaSet = new Set();
    refAreasRegla.forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) {
        reglaSet.add(String(d));
      }
    });
    const predictedSet = new Set();
    refAreasPredicted.forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) {
        predictedSet.add(String(d));
      }
    });

    // Custom plugin to draw background bands
    const backgroundPlugin = {
      id: 'backgroundBands',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;

        labels.forEach((label, idx) => {
          const xStart = scales.x.getPixelForValue(idx) - (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2;
          const xEnd = scales.x.getPixelForValue(idx) + (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2;

          if (reglaSet.has(label)) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 209, 220, 0.55)';
            ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
            ctx.restore();
          } else if (predictedSet.has(label)) {
            ctx.save();
            ctx.fillStyle = 'rgba(229, 231, 235, 0.65)';
            ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
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
            label: '🟠 Naproxeno',
            data: naproxenoData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#f97316',
            tension: 0.3,
            fill: false,
          },
          {
            label: '🔴 Imigran',
            data: imigranData,
            borderColor: '#e11d48',
            backgroundColor: 'rgba(225, 29, 72, 0.12)',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#e11d48',
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 11 },
              color: '#6b7280',
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#111827',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              afterBody: (items) => {
                const day = items[0]?.label;
                if (reglaSet.has(day)) return ['🌸 Día de regla'];
                if (predictedSet.has(day)) return ['⚪ Predicción de regla'];
                return [];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af', font: { size: 9 }, maxTicksLimit: 15 },
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

  if (!dailyData || dailyData.length === 0) return null;

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} />
      <div className="flex justify-center gap-3 text-[10px] font-medium mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-pink-500">
          <span className="inline-block w-3 h-3 rounded-sm bg-pink-200" /> Regla
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-200" /> Predicción
        </span>
      </div>
    </div>
  );
}
