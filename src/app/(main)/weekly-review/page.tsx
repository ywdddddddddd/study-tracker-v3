"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getWeeklyReview, getWeeklyReviews, saveWeeklyReview, type WeeklyReview } from "@/lib/db";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekLabel(start: string) {
  const d = new Date(start);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${start.slice(5)} ~ ${end.toISOString().slice(5, 10)}`;
}

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const thisWeek = getMonday(new Date());
  const lastWeek = getMonday(new Date(Date.now() - 7 * 86400000));

  const [thisReview, setThisReview] = useState<WeeklyReview>({
    id: undefined, weekStart: thisWeek, timeHole: "", focusHours: 0,
    budgetDental: 0, budgetEnglish: 0, budgetReview: 0, budgetSport: 0,
    goals: "", adjust: "", taskGoals: "", progressGoals: "",
  });
  const [lastReview, setLastReview] = useState<WeeklyReview | null>(null);
  const [allReviews, setAllReviews] = useState<WeeklyReview[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [tr, lr, all] = await Promise.all([
          getWeeklyReview(thisWeek),
          getWeeklyReview(lastWeek),
          getWeeklyReviews(),
        ]);
        if (tr) setThisReview(tr);
        setLastReview(lr);
        setAllReviews(all);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveWeeklyReview(thisReview);
      toast.success("已保存");
    } catch (e) { toast.error("保存失败"); }
    finally { setSaving(false); }
  }

  function update(field: keyof WeeklyReview, value: string | number) {
    setThisReview((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl">周回顾</h1>
        <p className="text-sm text-muted-foreground mt-1">{getWeekLabel(thisWeek)}</p>
      </motion.div>

      {/* 5-week status grid */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">近期周次</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto">
              {allReviews.slice(-5).map((r) => (
                <Badge key={r.weekStart} variant="outline" className="shrink-0">
                  {getWeekLabel(r.weekStart)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Week */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                本周回顾
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "时间黑洞", field: "timeHole" as const, placeholder: "什么占用了最多时间？" },
                { label: "本周目标", field: "goals" as const, placeholder: "本周最重要的目标" },
                { label: "任务目标", field: "taskGoals" as const, placeholder: "具体任务目标" },
                { label: "进度目标", field: "progressGoals" as const, placeholder: "进度里程碑" },
                { label: "下周调整", field: "adjust" as const, placeholder: "需要改进的地方" },
              ].map((f) => (
                <div key={f.field}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    value={(thisReview[f.field] as string) || ""}
                    onChange={(e) => update(f.field, e.target.value)}
                    placeholder={f.placeholder}
                    className="mt-1"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "专注小时", field: "focusHours" as const },
                  { label: "口腔预算", field: "budgetDental" as const },
                  { label: "英语预算", field: "budgetEnglish" as const },
                  { label: "运动预算", field: "budgetSport" as const },
                ].map((f) => (
                  <div key={f.field}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      value={thisReview[f.field] || 0}
                      onChange={(e) => update(f.field, Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "保存中..." : "保存"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Last Week (read-only) */}
        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                上周回顾 · {getWeekLabel(lastWeek)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : lastReview ? (
                <div className="space-y-3 text-sm">
                  {lastReview.timeHole && <p><span className="text-muted-foreground">时间黑洞: </span>{lastReview.timeHole}</p>}
                  {lastReview.goals && <p><span className="text-muted-foreground">目标: </span>{lastReview.goals}</p>}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {lastReview.focusHours > 0 && <span>专注 {lastReview.focusHours}h</span>}
                    {lastReview.budgetDental > 0 && <span>口腔 ¥{lastReview.budgetDental}</span>}
                    {lastReview.budgetEnglish > 0 && <span>英语 ¥{lastReview.budgetEnglish}</span>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无上周记录</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
