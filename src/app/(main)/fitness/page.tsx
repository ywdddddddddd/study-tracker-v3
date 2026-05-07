"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getGymSchedules, saveGymSchedule, getWorkoutLog, type WorkoutLog } from "@/lib/db";

const GYM_TYPES = ["推", "拉", "腿", "休"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  const dates: { date: string; weekday: string; iso: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dates.push({ date: iso, weekday: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i], iso });
  }
  return dates;
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FitnessPage() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<{ date: string; gym: string }[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutLog | null>(null);
  const weekDates = getWeekDates();
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [scheds, workout] = await Promise.all([getGymSchedules(), getWorkoutLog(today)]);
      setSchedules(scheds);
      setTodayWorkout(workout);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function updateGym(date: string, gym: string) {
    try {
      await saveGymSchedule(date, gym);
      setSchedules((prev) => {
        const idx = prev.findIndex((s) => s.date === date);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { date, gym };
          return copy;
        }
        return [...prev, { date, gym }];
      });
      toast.success(`已更新为「${gym}」`);
    } catch (e) {
      toast.error("更新失败");
    }
  }

  function getGym(date: string) {
    return schedules.find((s) => s.date === date)?.gym || "";
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl">健身运动</h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </motion.div>

      {/* Schedule Grid */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              本周训练日程
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {weekDates.map((d) => (
                    <TableHead key={d.iso} className="text-center text-xs">
                      <div>{d.weekday}</div>
                      <div className="text-muted-foreground font-normal">{d.iso.slice(5)}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {weekDates.map((d) => {
                    const gym = getGym(d.iso);
                    return (
                      <TableCell key={d.iso} className="text-center p-2">
                        <Select value={gym || "—"} onValueChange={(v) => updateGym(d.iso, v || "—")}>
                          <SelectTrigger className="h-8 w-full text-xs justify-center gap-1 [&>svg]:hidden">
                            <SelectValue placeholder="—" />
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="—">—</SelectItem>
                            {GYM_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {gym && (
                          <Badge
                            variant="outline"
                            className={
                              gym === "推" ? "bg-blue-50 text-blue-700" :
                              gym === "拉" ? "bg-green-50 text-green-700" :
                              gym === "腿" ? "bg-orange-50 text-orange-700" :
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {gym}
                          </Badge>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Workout */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">今日训练记录</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : todayWorkout ? (
              <div className="space-y-3">
                <Badge>{todayWorkout.type}</Badge>
                <div className="text-sm text-muted-foreground">
                  时长 {todayWorkout.duration} 分钟
                </div>
                {todayWorkout.exercises.map((ex, i) => (
                  <div key={i} className="flex justify-between text-sm border-b pb-1 last:border-0">
                    <span>{ex.name}</span>
                    <span className="text-muted-foreground">
                      {ex.sets.map((s) => `${s.reps}×${s.weight}kg`).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">今天还没有训练记录</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
