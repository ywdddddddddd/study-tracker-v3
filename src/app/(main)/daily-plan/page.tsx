"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { Play, Pause, Square, RotateCcw, ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp, X, Plus, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { type DailyPlan, type Task, getDailyPlan, saveDailyPlan, getCustomSchedules, getTaskTemplates, saveTaskTemplate, deleteTaskTemplate } from "@/lib/db";
import { STUDY_SCHEDULE } from "@/data/presets";

// ── Timer hook (inlined from v2) ──
function useTimer() {
  const [s,setS]=useState({isRunning:false,isPaused:false,elapsed:0});
  const iv=useRef<ReturnType<typeof setInterval>|null>(null);const st=useRef(0);const pe=useRef(0);
  const start=useCallback(()=>{st.current=Date.now();pe.current=s.elapsed;setS(p=>({...p,isRunning:true,isPaused:false}));iv.current=setInterval(()=>{setS(p=>({...p,elapsed:pe.current+Math.floor((Date.now()-st.current)/1000)}));},1000);},[s.elapsed]);
  const pause=useCallback(()=>{if(iv.current)clearInterval(iv.current);pe.current=s.elapsed;setS(p=>({...p,isPaused:true,isRunning:false}));},[s.elapsed]);
  const resume=useCallback(()=>{st.current=Date.now();setS(p=>({...p,isPaused:false,isRunning:true}));iv.current=setInterval(()=>{setS(p=>({...p,elapsed:pe.current+Math.floor((Date.now()-st.current)/1000)}));},1000);},[]);
  const stop=useCallback(()=>{if(iv.current)clearInterval(iv.current);const f=s.elapsed;setS({isRunning:false,isPaused:false,elapsed:0});pe.current=0;return f;},[s.elapsed]);
  const reset=useCallback(()=>{if(iv.current)clearInterval(iv.current);setS({isRunning:false,isPaused:false,elapsed:0});pe.current=0;},[]);
  useEffect(()=>()=>{if(iv.current)clearInterval(iv.current);},[]);
  return {...s,start,pause,resume,stop,reset};
}
function fmtDur(sec:number):string{const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}

const SECTIONS=[{key:"english",label:"英语",color:"text-blue-600",bg:"bg-blue-50",border:"border-blue-200"},{key:"dental",label:"专业课",color:"text-emerald-600",bg:"bg-emerald-50",border:"border-emerald-200"},{key:"other",label:"其它",color:"text-amber-600",bg:"bg-amber-50",border:"border-amber-200"}] as const;

function TimerModal({open,onClose,taskName,onSave}:{open:boolean;onClose:()=>void;taskName:string;onSave:(mins:number)=>void}){
  const t=useTimer();const [acc,setAcc]=useState(0);if(!open)return null;
  const handleStop=()=>{const secs=t.stop();setAcc(a=>a+Math.round(secs/60));};
  return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className="bg-background rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-6" onClick={e=>e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-muted-foreground">{taskName}</h3>
      <div className="text-7xl font-mono font-bold tracking-wider py-4">{fmtDur(t.elapsed)}</div>
      {acc>0&&<div className="text-sm text-muted-foreground">本次已累计: {acc} 分钟</div>}
      <div className="flex justify-center gap-4">
        {!t.isRunning&&!t.isPaused&&<Button size="lg" onClick={t.start} className="text-lg px-8 py-6 h-auto"><Play className="w-6 h-6 mr-2"/>开始</Button>}
        {t.isRunning&&<Button size="lg" variant="outline" onClick={t.pause} className="text-lg px-8 py-6 h-auto"><Pause className="w-6 h-6 mr-2"/>暂停</Button>}
        {t.isPaused&&<Button size="lg" onClick={t.resume} className="text-lg px-8 py-6 h-auto"><Play className="w-6 h-6 mr-2"/>继续</Button>}
        {(t.isRunning||t.isPaused)&&<Button size="lg" variant="secondary" onClick={handleStop} className="text-lg px-8 py-6 h-auto"><Square className="w-6 h-6 mr-2"/>停止</Button>}
        <Button size="lg" variant="ghost" onClick={t.reset} className="text-lg px-4 py-6 h-auto"><RotateCcw className="w-6 h-6"/></Button>
      </div>
      <div className="flex gap-2 justify-center"><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={()=>{onSave(acc);setAcc(0);onClose();}} disabled={acc===0}>保存 ({acc}min)</Button></div>
    </div></div>);
}

export default function DailyPlanPage() {
  const [date,setDate]=useState(dayjs().format("YYYY-MM-DD"));
  const [plan,setPlan]=useState<DailyPlan|null>(null);
  const [saved,setSaved]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({english:false,dental:false,other:false});
  const [timerOpen,setTimerOpen]=useState(false);const [timerTaskIdx,setTimerTaskIdx]=useState(-1);
  const [customSchedules,setCustomSchedules]=useState<{date:string;weekday:string;gym:string;tasks:{text:string;category:"english"|"dental"|"other"}[]}[]>([]);
  const [taskTemplates,setTaskTemplates]=useState<{id:string;text:string;category:"english"|"dental"|"other";plannedMinutes:number}[]>([]);
  useEffect(()=>{getTaskTemplates().then(d=>setTaskTemplates(d as any));},[]);
  const [templatePickerOpen,setTemplatePickerOpen]=useState(false);
  const [templatePickerCat,setTemplatePickerCat]=useState<"english"|"dental"|"other">("other");
  const [completionOpen,setCompletionOpen]=useState(false);const [completionTaskIdx,setCompletionTaskIdx]=useState(-1);
  const [completionRate,setCompletionRate]=useState(100);const [completionReason,setCompletionReason]=useState("");
  const [showSchedule,setShowSchedule]=useState(false);const [datesWithData,setDatesWithData]=useState<Set<string>>(new Set());

  useEffect(()=>{if(templatePickerOpen){getTaskTemplates().then(d=>setTaskTemplates(d as any));}},[templatePickerOpen]);
  const loadCS=useCallback(async()=>{setCustomSchedules(await getCustomSchedules());},[]);
  useEffect(()=>{loadCS();},[loadCS]);
  const getEffectiveSchedule=useCallback((d:string)=>{const c=customSchedules.find(s=>s.date===d);return c||STUDY_SCHEDULE.find(s=>s.date===d);},[customSchedules]);

  const loadPlan=useCallback(async()=>{
    const existing=await getDailyPlan(date);const sched=getEffectiveSchedule(date);
    if(existing)setPlan(existing);
    else if(sched){const tasks:Task[]=sched.tasks.map((t,i)=>({id:`${date}-${i}`,text:t.text,category:t.category,status:"pending",plannedMinutes:30,actualMinutes:0,timerAccumulated:0}));setPlan({date,tasks,conquered:"",difficulty:"",adjust:"",completion:"",totalFocusMinutes:0});}
    else setPlan({date,tasks:[],conquered:"",difficulty:"",adjust:"",completion:"",totalFocusMinutes:0});
  },[date,getEffectiveSchedule]);
  useEffect(()=>{loadPlan();},[loadPlan]);

  const updateTask=(idx:number,task:Task)=>{if(!plan)return;const tasks=[...plan.tasks];tasks[idx]=task;setPlan({...plan,tasks});};
  const addTask=()=>{if(!plan)return;setPlan({...plan,tasks:[...plan.tasks,{id:`${Date.now()}`,text:"",category:"english",status:"pending",plannedMinutes:30,actualMinutes:0,timerAccumulated:0}]});};
  const removeTask=(idx:number)=>{if(!plan)return;setPlan({...plan,tasks:plan.tasks.filter((_,i)=>i!==idx)});};
  const toggleStatus=(idx:number)=>{if(!plan)return;
    const t=plan.tasks[idx];if(t.status==="completed"){updateTask(idx,{...t,status:"pending",actualMinutes:0});return;}
    if(t.status==="failed"){updateTask(idx,{...t,status:"pending",actualMinutes:0,completionRate:undefined,reason:undefined});return;}
    setCompletionTaskIdx(idx);setCompletionRate(100);setCompletionReason("");setCompletionOpen(true);
  };
  const confirmCompletion=()=>{if(!plan||completionTaskIdx<0)return;
    const t=plan.tasks[completionTaskIdx];const actual=completionRate===100?t.plannedMinutes:Math.round(t.plannedMinutes*completionRate/100);
    updateTask(completionTaskIdx,{...t,status:completionRate===100?"completed":"failed",actualMinutes:actual,completionRate,reason:completionReason||undefined});
    setCompletionOpen(false);
  };
  const startTimer=(idx:number)=>{if(!plan)return;updateTask(idx,{...plan.tasks[idx],status:"doing"});setTimerTaskIdx(idx);setTimerOpen(true);};
  const saveTimer=(mins:number)=>{if(!plan||timerTaskIdx<0)return;
    const t=plan.tasks[timerTaskIdx];updateTask(timerTaskIdx,{...t,status:"completed",actualMinutes:t.actualMinutes+mins,timerAccumulated:t.timerAccumulated+mins});
    setTimerTaskIdx(-1);
  };
  const save=async()=>{if(!plan)return;
    const totalFocus=plan.tasks.reduce((s,t)=>s+(t.status==="completed"?t.actualMinutes:0),0);
    await saveDailyPlan({...plan,totalFocusMinutes:totalFocus});setSaved(true);setTimeout(()=>setSaved(false),2000);toast.success("已保存");
  };
  const goDate=(delta:number)=>setDate(dayjs(date).add(delta,"day").format("YYYY-MM-DD"));
  const addTaskTemplate=async(t:{id:string;text:string;category:string;plannedMinutes:number})=>{
    if(!plan)return;const nt:Task={id:`${Date.now()}`,text:t.text,category:t.category as any,status:"pending",plannedMinutes:t.plannedMinutes,actualMinutes:0,timerAccumulated:0};
    setPlan({...plan,tasks:[...plan.tasks,nt]});
  };

  const grouped=(cat:string)=>plan?.tasks.filter(t=>t.category===cat)||[];
  const completed=plan?.tasks.filter(t=>t.status==="completed").length||0;
  const total=plan?.tasks.length||0;
  const rate=total>0?Math.round((completed/total)*100):0;

  return (<div className="space-y-6">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="flex items-center gap-2 flex-wrap">
      <h1 className="font-heading text-2xl">每日学习</h1>
      <Button variant="outline" size="icon" onClick={()=>goDate(-1)}><ChevronLeft className="h-4 w-4"/></Button>
      <Input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-auto h-8 text-sm"/>
      <Button variant="outline" size="icon" onClick={()=>goDate(1)}><ChevronRight className="h-4 w-4"/></Button>
      <span className="text-sm text-muted-foreground">{dayjs(date).format("ddd")}</span>
      <Button variant="outline" size="sm" onClick={()=>setShowSchedule(!showSchedule)}>📅 {showSchedule?"隐藏日程":"学习日程"}</Button>
      <Button onClick={save} className="ml-auto">{saved?"✅ 已保存":"💾 保存"}</Button>
    </motion.div>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <Card><CardContent className="p-4"><div className="flex justify-between text-sm mb-1"><span>完成率</span><span className="font-medium">{rate}% ({completed}/{total})</span></div><Progress value={rate} className="h-2"/></CardContent></Card>
        {SECTIONS.map(sec=>{const tasks=grouped(sec.key);if(tasks.length===0)return null;
          return (<Card key={sec.key}><CardHeader className="pb-2 cursor-pointer" onClick={()=>setCollapsed(c=>({...c,[sec.key]:!c[sec.key]}))}>
            <CardTitle className="text-sm font-medium flex items-center justify-between"><span className={`${sec.color}`}>{sec.label} ({tasks.length})</span>{collapsed[sec.key]?<ChevronDown className="h-4 w-4"/>:<ChevronUp className="h-4 w-4"/>}</CardTitle></CardHeader>
            {!collapsed[sec.key]&&<CardContent className="space-y-2">
              {tasks.map((t,i)=>{const globalIdx=plan!.tasks.indexOf(t);
                return (<div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg border ${t.status==="completed"?"bg-green-50/50":t.status==="doing"?"bg-blue-50/50":t.status==="failed"?"bg-red-50/50":""}`}>
                  <button onClick={()=>toggleStatus(globalIdx)} className="shrink-0 text-lg">{t.status==="completed"?"✅":t.status==="failed"?"❌":t.status==="doing"?"🔥":"⬜"}</button>
                  <Input value={t.text} onChange={e=>updateTask(globalIdx,{...t,text:e.target.value})} className={`flex-1 h-8 bg-transparent border-0 px-0 focus-visible:ring-0 ${t.status==="completed"?"line-through opacity-60":""}`} placeholder="任务名称..."/>
                  {t.plannedMinutes>0&&<span className="text-xs text-muted-foreground">{t.plannedMinutes}min</span>}
                  <Button variant="ghost" size="icon-xs" onClick={()=>startTimer(globalIdx)}><Clock className="h-3 w-3"/></Button>
                  <Button variant="ghost" size="icon-xs" onClick={()=>removeTask(globalIdx)}><X className="h-3 w-3"/></Button>
                </div>);})}
            </CardContent>}</Card>);})}
        <Button variant="outline" onClick={addTask} className="w-full"><Plus className="w-4 h-4 mr-1"/>添加任务</Button>
        {/* Reflection fields */}
        {plan&&<Card><CardContent className="p-4 space-y-2">
          <Input placeholder="今日攻克" value={plan.conquered} onChange={e=>setPlan({...plan,conquered:e.target.value})}/>
          <Textarea placeholder="难度评估" value={plan.difficulty} onChange={e=>setPlan({...plan,difficulty:e.target.value})} rows={2}/>
          <Textarea placeholder="调整方向" value={plan.adjust} onChange={e=>setPlan({...plan,adjust:e.target.value})} rows={2}/>
          <Textarea placeholder="完成总结" value={plan.completion} onChange={e=>setPlan({...plan,completion:e.target.value})} rows={2}/>
        </CardContent></Card>}
      </div>
      {/* Templates sidebar */}
      <div className="space-y-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">任务模板</CardTitle></CardHeader><CardContent className="space-y-1">
          {taskTemplates.map(t=>(<button key={t.id} onClick={()=>addTaskTemplate(t)} className="w-full text-left text-sm p-2 rounded hover:bg-accent transition-colors"><div>{t.text}</div><div className="text-xs text-muted-foreground">{t.category==="english"?"英语":t.category==="dental"?"专业课":"其它"} · {t.plannedMinutes}min</div></button>))}
          {taskTemplates.length===0&&<p className="text-xs text-muted-foreground text-center py-4">暂无模板</p>}
        </CardContent></Card>
      </div>
    </div>
    <TimerModal open={timerOpen} onClose={()=>{setTimerOpen(false);setTimerTaskIdx(-1);}} taskName={plan?.tasks[timerTaskIdx]?.text||""} onSave={saveTimer}/>
    <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
      <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>任务完成</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-sm">完成率 (%)</label><Input type="number" value={completionRate} onChange={e=>setCompletionRate(Number(e.target.value))} min={0} max={100}/></div>
          {completionRate<100&&<div><label className="text-sm">未完成原因</label><Input value={completionReason} onChange={e=>setCompletionReason(e.target.value)} placeholder="为什么没完成？"/></div>}
        </div>
        <div className="flex gap-2 justify-end"><Button variant="outline" onClick={()=>setCompletionOpen(false)}>取消</Button><Button onClick={confirmCompletion}>确认</Button></div>
      </DialogContent></Dialog>
  </div>);
}
