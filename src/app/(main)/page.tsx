"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Flame,
  UtensilsCrossed,
  Dumbbell,
  Clock,
  CheckCircle2,
  Target,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOrCreateProfile,
  getDailyPlan,
  getFoodEntries,
  getWorkoutLog,
  getSleepRecords,
  type Profile,
  type DailyPlan,
  type FoodEntry,
  type WorkoutLog,
  type SleepRecord,
} from "@/lib/db";
import { calculateBMR } from "@/lib/db";

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let cardioTotal = 0;
  for (const ex of w.exercises) {
    if (ex.kind === "cardio" && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      cardioTotal += mets * weightKg * (duration / 60);
    }
  }
  const cardioDuration = w.exercises
    .filter((e) => e.kind === "cardio")
    .reduce((sum, e) => sum + (e.cardioParams?.duration || 0), 0);
  const strengthDuration = Math.max(0, (w.duration || 0) - cardioDuration);
  const strengthTotal =
    strengthDuration > 0 ? 4.5 * weightKg * (strengthDuration / 60) : 0;
  return Math.round(cardioTotal + strengthTotal);
}

function BMRCalc(
  weight: number,
  height: number,
  age: number,
  gender: string
): number {
  if (gender === "male")
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
} as const;

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
} as const;

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [foodTotal, setFoodTotal] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [workoutBurn, setWorkoutBurn] = useState(0);
  const [latestSleep, setLatestSleep] = useState<SleepRecord | null>(null);
  const [studyStats, setStudyStats] = useState({ completed: 0, total: 0, focusMinutes: 0 });
  const today = getToday();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const p = await getOrCreateProfile();
      setProfile(p);

      const [plan, foods, workout, sleeps] = await Promise.all([
        getDailyPlan(today),
        getFoodEntries(today),
        getWorkoutLog(today),
        getSleepRecords(7),
      ]);

      setTodayPlan(plan);

      // Study stats
      let completed = 0;
      let total = 0;
      let focusMinutes = 0;
      if (plan) {
        total = plan.tasks.length;
        completed = plan.tasks.filter((t) => t.status === "completed").length;
        focusMinutes = plan.totalFocusMinutes || 0;
      }
      setStudyStats({ completed, total, focusMinutes });

      // Food totals
      setFoodTotal({
        calories: foods.reduce((s, f) => s + f.calories, 0),
        protein: foods.reduce((s, f) => s + f.protein, 0),
        carbs: foods.reduce((s, f) => s + f.carbs, 0),
        fat: foods.reduce((s, f) => s + f.fat, 0),
      });

      // Workout
      if (workout) {
        setWorkoutBurn(calcWorkoutBurn(workout, p.weight));
      }

      // Latest sleep
      if (sleeps.length > 0) {
        setLatestSleep(sleeps[sleeps.length - 1]);
      }
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }

  const bmr = profile ? BMRCalc(profile.weight, profile.height, profile.age, profile.gender) : 0;
  const tdee = Math.round(bmr * 1.55);
  const studyRate = studyStats.total > 0 ? Math.round((studyStats.completed / studyStats.total) * 100) : 0;
  const netCalories = foodTotal.calories - workoutBurn - bmr;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-heading text-2xl text-foreground">仪表盘</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {today} · 今日概览
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Activity className="h-3 w-3 mr-1" />
          在线
        </Badge>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Study Progress */}
        <motion.div variants={item}>
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                今日学习
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {studyStats.completed}
                <span className="text-lg text-muted-foreground font-normal">
                  /{studyStats.total}
                </span>
              </div>
              <Progress value={studyRate} className="mt-2 h-1.5" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {studyStats.focusMinutes} 分钟专注
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* BMR / Metabolism */}
        <motion.div variants={item}>
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                基础代谢
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {bmr}
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  kcal
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                TDEE ≈ {tdee} kcal · {profile?.weight}kg
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Food Intake */}
        <motion.div variants={item}>
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-green-600" />
                今日摄入
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {foodTotal.calories}
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  kcal
                </span>
              </div>
              <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>P: {foodTotal.protein}g</span>
                <span>C: {foodTotal.carbs}g</span>
                <span>F: {foodTotal.fat}g</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Workout Burn */}
        <motion.div variants={item}>
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-blue-500" />
                运动消耗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {workoutBurn}
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  kcal
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                净摄入 ≈ {netCalories} kcal
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Second row: Sleep + More Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Sleep */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                最近睡眠
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestSleep ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-display">
                      {Math.floor(latestSleep.duration / 60)}
                    </span>
                    <span className="text-lg text-muted-foreground">
                      小时{latestSleep.duration % 60}分
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>
                      入睡 {latestSleep.bedTime}
                    </span>
                    <span>
                      起床 {latestSleep.wakeTime}
                    </span>
                    <span>
                      质量 {"★".repeat(latestSleep.quality)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无睡眠记录</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Summary */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                今日总结
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">任务完成率</span>
                  <span className="font-medium">{studyRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">热量平衡</span>
                  <span className={netCalories <= 0 ? "text-green-600 font-medium" : "text-orange-500 font-medium"}>
                    {netCalories > 0 ? "+" : ""}{netCalories} kcal
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">专注时长</span>
                  <span className="font-medium">{studyStats.focusMinutes} min</span>
                </div>
                {todayPlan?.difficulty && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">难度评估</span>
                    <span className="font-medium">{todayPlan.difficulty}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
