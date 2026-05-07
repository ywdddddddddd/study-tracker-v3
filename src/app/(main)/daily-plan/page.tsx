"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, Check, Trash2, Play, Pause, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getDailyPlan, saveDailyPlan, getTaskTemplates, type DailyPlan, type Task } from "@/lib/db";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyPlanPage() {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [templates, setTemplates] = useState<{ id: string; text: string; category: string; plannedMinutes: number }[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCat, setNewTaskCat] = useState("english");
  const [newTaskMins, setNewTaskMins] = useState(30);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [p, temps] = await Promise.all([getDailyPlan(today), getTaskTemplates()]);
      setPlan(p || { date: today, tasks: [], conquered: "", difficulty: "", adjust: "", completion: "", totalFocusMinutes: 0 });
      setTemplates(temps);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function addTask() {
    if (!newTaskText.trim() || !plan) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      category: newTaskCat as "english" | "dental" | "other",
      status: "pending",
      plannedMinutes: newTaskMins,
      actualMinutes: 0,
      timerAccumulated: 0,
    };
    const updated = { ...plan, tasks: [...plan.tasks, newTask] };
    try {
      await saveDailyPlan(updated);
      setPlan(updated);
      setNewTaskText("");
      toast.success("任务已添加");
    } catch (e) { toast.error("添加失败"); }
  }

  async function toggleTask(id: string) {
    if (!plan) return;
    const updated = {
      ...plan,
      tasks: plan.tasks.map((t) =>
        t.id === id ? { ...t, status: t.status === "completed" ? "pending" as const : "completed" as const, actualMinutes: t.status === "completed" ? 0 : t.plannedMinutes } : t
      ),
    };
    await saveDailyPlan(updated);
    setPlan(updated);
  }

  async function removeTask(id: string) {
    if (!plan) return;
    const updated = { ...plan, tasks: plan.tasks.filter((t) => t.id !== id) };
    await saveDailyPlan(updated);
    setPlan(updated);
  }

  async function addTemplate(t: typeof templates[number]) {
    if (!plan) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: t.text,
      category: t.category as "english" | "dental" | "other",
      status: "pending",
      plannedMinutes: t.plannedMinutes,
      actualMinutes: 0,
      timerAccumulated: 0,
    };
    const updated = { ...plan, tasks: [...plan.tasks, newTask] };
    await saveDailyPlan(updated);
    setPlan(updated);
    toast.success(`已添加模板: ${t.text}`);
  }

  const completed = plan?.tasks.filter((t) => t.status === "completed").length || 0;
  const total = plan?.tasks.length || 0;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl">每日学习</h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </motion.div>

      {/* Progress card */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">任务进度</span>
              <span className="text-sm text-muted-foreground">{completed}/{total}</span>
            </div>
            <Progress value={rate} className="h-2" />
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task list */}
        <motion.div variants={container} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
          {/* Add task */}
          <Card>
            <CardContent className="p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="新任务名称..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  className="h-8 flex-1"
                />
                <Select value={newTaskCat} onValueChange={(v) => setNewTaskCat(v || "english")}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">英语</SelectItem>
                    <SelectItem value="dental">口腔</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={newTaskMins}
                  onChange={(e) => setNewTaskMins(Number(e.target.value))}
                  className="h-8 w-16"
                />
                <Button size="sm" onClick={addTask}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            plan?.tasks.map((task) => (
              <motion.div key={task.id} variants={item} layout>
                <Card className={task.status === "completed" ? "opacity-60" : ""}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Switch
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {task.text}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {task.category === "english" ? "英语" : task.category === "dental" ? "口腔" : "其他"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{task.plannedMinutes}min</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-xs" onClick={() => removeTask(task.id)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
          {!loading && plan?.tasks.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">今天还没有任务，添加一个吧</p>
          )}
        </motion.div>

        {/* Templates sidebar */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">任务模板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.map((t) => (
                <motion.button
                  key={t.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addTemplate(t)}
                  className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors"
                >
                  <p className="text-sm">{t.text}</p>
                  <p className="text-xs text-muted-foreground">{t.plannedMinutes}min</p>
                </motion.button>
              ))}
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">暂无模板</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
