"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { Moon, Plus, Pencil, Trash2, Weight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getSleepRecords, addSleepRecord, updateSleepRecord, deleteSleepRecord, getWeightRecords, addWeightRecord, deleteWeightRecord, getOrCreateProfile, getFoodEntries, getWorkoutLog, type SleepRecord, type WeightRecord } from "@/lib/db";

const item={hidden:{opacity:0,y:12},show:{opacity:1,y:0,transition:{duration:0.3,ease:"easeOut" as const}}};
const container={hidden:{opacity:0},show:{opacity:1,transition:{staggerChildren:0.04}}};

function calcBMR(w:number,h:number,a:number,g:string):number{return Math.round(g==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161);}
function calcWorkoutBurn(w:any,kg:number):number{let ct=0;for(const ex of w.exercises){if(ex.kind==="cardio"&&ex.cardioParams){const s=ex.cardioParams.speed||0,i=ex.cardioParams.incline||0,d=ex.cardioParams.duration||0;ct+=((s*0.2+i*0.9+3.5)/3.5)*kg*(d/60);}}const cd=w.exercises.filter((e:any)=>e.kind==="cardio").reduce((s:number,e:any)=>s+(e.cardioParams?.duration||0),0);const sd=Math.max(0,(w.duration||0)-cd);return Math.round(ct+(sd>0?4.5*kg*(sd/60):0));}
function durFromTimes(bed:string,wake:string):number{const[bh,bm]=bed.split(":").map(Number);const[wh,wm]=wake.split(":").map(Number);let m=wh*60+wm-bh*60-bm;if(m<=0)m+=24*60;return m;}

export default function HealthPage(){
  const[tab,setTab]=useState("sleep");
  const[records,setRecords]=useState<SleepRecord[]>([]);
  const[weights,setWeights]=useState<WeightRecord[]>([]);
  const[dialogOpen,setDialogOpen]=useState(false);const[editing,setEditing]=useState<SleepRecord|null>(null);
  const[form,setForm]=useState({date:dayjs().subtract(1,"day").format("YYYY-MM-DD"),bedTime:"23:00",wakeTime:"07:00",quality:3 as 1|2|3|4|5,note:""});
  const[weightForm,setWeightForm]=useState({date:dayjs().format("YYYY-MM-DD"),weight:84,bodyFat:0,note:""});
  const[profile,setProfile]=useState<any>(null);
  const[foodCals,setFoodCals]=useState(0);const[workoutBurn,setWorkoutBurn]=useState(0);

  useEffect(()=>{load();},[]);
  async function load(){try{const[s,w,p]=await Promise.all([getSleepRecords(),getWeightRecords(),getOrCreateProfile()]);setRecords(s);setWeights(w);setProfile(p);
    const today=dayjs().format("YYYY-MM-DD");const[foods,wo]=await Promise.all([getFoodEntries(today),getWorkoutLog(today)]);setFoodCals(foods.reduce((a,f)=>a+f.calories,0));if(wo)setWorkoutBurn(calcWorkoutBurn(wo,p.weight));}catch(e){console.error(e);}}

  function openNew(){setEditing(null);setForm({date:dayjs().subtract(1,"day").format("YYYY-MM-DD"),bedTime:"23:00",wakeTime:"07:00",quality:3,note:""});setDialogOpen(true);}
  function openEdit(r:SleepRecord){setEditing(r);setForm({date:r.date,bedTime:r.bedTime,wakeTime:r.wakeTime,quality:r.quality,note:r.note||""});setDialogOpen(true);}
  async function handleSaveSleep(){try{const d=durFromTimes(form.bedTime,form.wakeTime);if(editing)await updateSleepRecord({...editing,...form,duration:d});else await addSleepRecord({...form,duration:d});setDialogOpen(false);await load();toast.success("已保存");}catch(e){toast.error("保存失败");}}
  async function handleDeleteSleep(id:number){try{await deleteSleepRecord(id);await load();toast.success("已删除");}catch(e){toast.error("删除失败");}}
  async function addWeight(){if(!weightForm.weight)return;try{await addWeightRecord(weightForm);setWeightForm({date:dayjs().format("YYYY-MM-DD"),weight:84,bodyFat:0,note:""});await load();toast.success("体重已记录");}catch(e){toast.error("记录失败");}}
  async function removeWeight(id:number){try{await deleteWeightRecord(id);await load();}catch(e){toast.error("删除失败");}}

  const bmr=profile?calcBMR(profile.weight,profile.height,profile.age,profile.gender):0;
  const net=foodCals-workoutBurn-bmr;
  const avgSleep=records.length>0?Math.round(records.reduce((s,r)=>s+r.duration,0)/records.length):0;
  const avgQuality=records.length>0?(records.reduce((s,r)=>s+r.quality,0)/records.length).toFixed(1):"0";

  return <div className="space-y-6">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><h1 className="font-heading text-2xl">健康</h1><p className="text-sm text-muted-foreground mt-1">{dayjs().format("YYYY-MM-DD")}</p></motion.div>
    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[{label:"BMR",value:bmr,unit:"kcal",color:"text-blue-600"},{label:"今日摄入",value:foodCals,unit:"kcal",color:"text-orange-600"},{label:"运动消耗",value:workoutBurn,unit:"kcal",color:"text-green-600"},{label:"净热量",value:net,unit:"kcal",color:net<=0?"text-emerald-600":"text-red-600"}].map((s,i)=>(
        <motion.div key={s.label} variants={item}><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-xl font-bold font-display ${s.color}`}>{s.value}<span className="text-xs font-normal text-muted-foreground ml-1">{s.unit}</span></p></CardContent></Card></motion.div>))}
    </motion.div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="sleep" className="text-xs"><Moon className="h-3 w-3 mr-1"/>睡眠</TabsTrigger><TabsTrigger value="weight" className="text-xs"><Weight className="h-3 w-3 mr-1"/>体重</TabsTrigger></TabsList>
      <TabsContent value="sleep" className="space-y-4 mt-4">
        <div className="flex justify-between"><div className="grid grid-cols-4 gap-2 text-sm">{[{label:"总记录",value:records.length},{label:"平均",value:avgSleep>0?`${Math.floor(avgSleep/60)}h${avgSleep%60}m`:"—"},{label:"均质",value:`${avgQuality}/5`},{label:"入睡",value:records[records.length-1]?.bedTime||"—"}].map(s=>(<div key={s.label} className="text-center p-2 bg-muted/50 rounded"><div className="text-xs text-muted-foreground">{s.label}</div><div className="font-semibold">{s.value}</div></div>))}</div><Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1"/>新增</Button></div>
        <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">日期</TableHead><TableHead className="text-xs">入睡</TableHead><TableHead className="text-xs">起床</TableHead><TableHead className="text-xs">时长</TableHead><TableHead className="text-xs">质量</TableHead><TableHead className="text-xs w-16"/></TableRow></TableHeader><TableBody>
          {records.map(r=>(<TableRow key={r.id}><TableCell className="text-xs">{r.date}</TableCell><TableCell className="text-xs">{r.bedTime}</TableCell><TableCell className="text-xs">{r.wakeTime}</TableCell><TableCell className="text-xs font-medium">{Math.floor(r.duration/60)}h{r.duration%60}m</TableCell><TableCell className="text-xs">{"★".repeat(r.quality)}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon-xs" onClick={()=>openEdit(r)}><Pencil className="h-3 w-3"/></Button><Button variant="ghost" size="icon-xs" onClick={()=>r.id&&handleDeleteSleep(r.id)}><Trash2 className="h-3 w-3"/></Button></div></TableCell></TableRow>))}
          {records.length===0&&<TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">暂无睡眠记录</TableCell></TableRow>}
        </TableBody></Table></CardContent></Card>
      </TabsContent>
      <TabsContent value="weight" className="space-y-4 mt-4">
        <Card><CardContent className="p-4"><div className="flex gap-2 flex-wrap items-end">
          <div><Label className="text-xs">日期</Label><Input type="date" value={weightForm.date} onChange={e=>setWeightForm({...weightForm,date:e.target.value})} className="h-8"/></div>
          <div><Label className="text-xs">体重(kg)</Label><Input type="number" value={weightForm.weight||""} onChange={e=>setWeightForm({...weightForm,weight:parseFloat(e.target.value)||0})} className="h-8 w-24"/></div>
          <div><Label className="text-xs">体脂(%)</Label><Input type="number" value={weightForm.bodyFat||""} onChange={e=>setWeightForm({...weightForm,bodyFat:parseFloat(e.target.value)||0})} className="h-8 w-20"/></div>
          <Button size="sm" onClick={addWeight}>记录</Button>
        </div></CardContent></Card>
        <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">日期</TableHead><TableHead className="text-xs">体重</TableHead><TableHead className="text-xs">体脂</TableHead><TableHead className="text-xs w-8"/></TableRow></TableHeader><TableBody>
          {weights.map(w=>(<TableRow key={w.id}><TableCell className="text-xs">{w.date}</TableCell><TableCell className="text-xs font-medium">{w.weight} kg</TableCell><TableCell className="text-xs">{w.bodyFat||"-"}%</TableCell><TableCell><Button variant="ghost" size="icon-xs" onClick={()=>w.id&&removeWeight(w.id)}><Trash2 className="h-3 w-3"/></Button></TableCell></TableRow>))}
        </TableBody></Table></CardContent></Card>
      </TabsContent>
    </Tabs>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing?"编辑":"新增"}睡眠记录</DialogTitle></DialogHeader>
      <div className="space-y-3"><div><Label className="text-xs">日期</Label><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
        <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">入睡</Label><Input type="time" value={form.bedTime} onChange={e=>setForm(f=>({...f,bedTime:e.target.value}))}/></div><div><Label className="text-xs">起床</Label><Input type="time" value={form.wakeTime} onChange={e=>setForm(f=>({...f,wakeTime:e.target.value}))}/></div></div>
        <div><Label className="text-xs">质量</Label><Select value={String(form.quality)} onValueChange={(v)=>setForm(f=>({...f,quality:Number(v) as any}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(q=><SelectItem key={q} value={String(q)}>{"★".repeat(q)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">备注</Label><Input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></div></div>
      <div className="flex gap-2 justify-end"><Button variant="outline" onClick={()=>setDialogOpen(false)}>取消</Button><Button onClick={handleSaveSleep}>保存</Button></div>
    </DialogContent></Dialog>
  </div>;
}
