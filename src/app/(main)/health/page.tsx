"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Moon, Plus, Pencil, Trash2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getSleepRecords, addSleepRecord, updateSleepRecord, deleteSleepRecord, type SleepRecord } from "@/lib/db";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterday() {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function durationFromTimes(bed: string, wake: string): number {
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let mins = wh * 60 + wm - bh * 60 - bm;
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export default function HealthPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SleepRecord | null>(null);
  const [form, setForm] = useState({ date: yesterday(), bedTime: "23:00", wakeTime: "07:00", quality: 3 as 1|2|3|4|5, note: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const s = await getSleepRecords();
      setRecords(s);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm({ date: yesterday(), bedTime: "23:00", wakeTime: "07:00", quality: 3, note: "" });
    setDialogOpen(true);
  }

  function openEdit(r: SleepRecord) {
    setEditing(r);
    setForm({ date: r.date, bedTime: r.bedTime, wakeTime: r.wakeTime, quality: r.quality, note: r.note || "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      const duration = durationFromTimes(form.bedTime, form.wakeTime);
      if (editing) {
        await updateSleepRecord({ ...editing, ...form, duration });
        toast.success("已更新");
      } else {
        await addSleepRecord({ ...form, duration });
        toast.success("已添加");
      }
      setDialogOpen(false);
      await loadData();
    } catch (e) { toast.error("保存失败"); }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSleepRecord(id);
      toast.success("已删除");
      await loadData();
    } catch (e) { toast.error("删除失败"); }
  }

  const avgDuration = records.length > 0
    ? Math.round(records.reduce((s, r) => s + r.duration, 0) / records.length)
    : 0;
  const avgQuality = records.length > 0
    ? (records.reduce((s, r) => s + r.quality, 0) / records.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">健康睡眠</h1>
          <p className="text-sm text-muted-foreground mt-1">{getToday()}</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />新增记录</Button>
      </motion.div>

      {/* Summary */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "总记录", value: records.length, unit: "条" },
          { label: "平均睡眠", value: avgDuration > 0 ? `${Math.floor(avgDuration / 60)}h${avgDuration % 60}m` : "—", unit: "" },
          { label: "平均质量", value: avgQuality, unit: "/5" },
          { label: "最近入睡", value: records[records.length - 1]?.bedTime || "—", unit: "" },
        ].map((s, i) => (
          <motion.div key={s.label} variants={item}>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold font-display mt-1">{s.value}<span className="text-xs font-normal text-muted-foreground ml-1">{s.unit}</span></p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Records Table */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Moon className="h-4 w-4" />
              睡眠记录
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">日期</TableHead>
                  <TableHead className="text-xs">入睡</TableHead>
                  <TableHead className="text-xs">起床</TableHead>
                  <TableHead className="text-xs">时长</TableHead>
                  <TableHead className="text-xs">质量</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-xs">{r.bedTime}</TableCell>
                    <TableCell className="text-xs">{r.wakeTime}</TableCell>
                    <TableCell className="text-xs font-medium">{Math.floor(r.duration / 60)}h{r.duration % 60}m</TableCell>
                    <TableCell className="text-xs">{"★".repeat(r.quality)}{"☆".repeat(5 - r.quality)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => r.id && handleDelete(r.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && records.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">暂无睡眠记录</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑" : "新增"}睡眠记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">日期</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">入睡时间</Label>
                <Input type="time" value={form.bedTime} onChange={(e) => setForm((f) => ({ ...f, bedTime: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">起床时间</Label>
                <Input type="time" value={form.wakeTime} onChange={(e) => setForm((f) => ({ ...f, wakeTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">睡眠质量</Label>
              <Select value={String(form.quality)} onValueChange={(v) => setForm((f) => ({ ...f, quality: Number(v) as 1|2|3|4|5 }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((q) => (
                    <SelectItem key={q} value={String(q)}>{"★".repeat(q)}{"☆".repeat(5 - q)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">备注</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="备注..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
