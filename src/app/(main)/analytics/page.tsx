"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, PieChart, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllDailyPlans, getSleepRecords, getFoodEntriesInRange, getWorkoutLogsInRange, type DailyPlan, type SleepRecord, type FoodEntry, type WorkoutLog } from "@/lib/db";

const Doughnut = dynamic(() => import("react-chartjs-2").then((m) => m.Doughnut), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, Filler,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

function last30Days() {
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [sleeps, setSleeps] = useState<SleepRecord[]>([]);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const days = last30Days();
        const [pRecords, sRecords, fRecords, wRecords] = await Promise.all([
          getAllDailyPlans(),
          getSleepRecords(),
          getFoodEntriesInRange(days[0], days[days.length - 1]),
          getWorkoutLogsInRange(days[0], days[days.length - 1]),
        ]);
        setPlans(pRecords);
        setSleeps(sRecords);
        setFoods(fRecords);
        setWorkouts(wRecords);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Category distribution
  const catCounts = { english: 0, dental: 0, other: 0 };
  plans.forEach((p) => p.tasks.forEach((t) => { if (t.category in catCounts) catCounts[t.category as keyof typeof catCounts]++; }));

  const doughnutData = {
    labels: ["英语", "口腔", "其他"],
    datasets: [{ data: [catCounts.english, catCounts.dental, catCounts.other], backgroundColor: ["#337ab7", "#7266ba", "#23b7e5"], borderWidth: 0 }],
  };

  // Daily focus minutes (last 14 days)
  const days14 = last30Days().slice(-14);
  const barData = {
    labels: days14.map((d) => d.slice(5)),
    datasets: [
      { label: "专注分钟", data: days14.map((d) => plans.find((p) => p.date === d)?.totalFocusMinutes || 0), backgroundColor: "#337ab7", borderRadius: 4 },
    ],
  };

  // Sleep duration trend
  const sleepData = {
    labels: sleeps.map((s) => s.date.slice(5)),
    datasets: [
      {
        label: "睡眠时长(h)",
        data: sleeps.map((s) => +(s.duration / 60).toFixed(1)),
        borderColor: "#7266ba",
        backgroundColor: "rgba(114,102,186,0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl">数据分析</h1>
        <p className="text-sm text-muted-foreground mt-1">近30天趋势</p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Donut */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieChart className="h-4 w-4" />分类分布
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="w-56 h-56">
                {loading ? <Skeleton className="w-full h-full rounded-full" /> : <Doughnut data={doughnutData} options={{ plugins: { legend: { position: "bottom" } }, animation: { duration: 800 } }} />}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Focus Bar */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />每日专注
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {loading ? <Skeleton className="w-full h-full" /> : <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, animation: { duration: 800 } }} />}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sleep Line */}
        <motion.div variants={item} className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />睡眠趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {loading ? <Skeleton className="w-full h-full" /> : <Line data={sleepData} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 12 } }, animation: { duration: 800 } }} />}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
