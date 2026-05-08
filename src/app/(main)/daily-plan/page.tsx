"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dayjs from "dayjs";
import { Play, Pause, Square, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { type DailyPlan, type Task, getDailyPlan, saveDailyPlan, getCustomSchedules, getTaskTemplates, saveTaskTemplate, deleteTaskTemplate, getAllDailyPlans } from "@/lib/db";
import { STUDY_SCHEDULE } from "@/data/presets";

// ── Timer hook ──
function useTimer() { const [s,setS]=useState({isRunning:false,isPaused:false,elapsed:0}); const iv=useRef<ReturnType<typeof setInterval>|null>(null);const st=useRef(0);const pe=useRef(0);
  const start=useCallback(()=>{st.current=Date.now();pe.current=s.elapsed;setS(p=>({...p,isRunning:true,isPaused:false}));iv.current=setInterval(()=>{setS(p=>({...p,elapsed:pe.current+Math.floor((Date.now()-st.current)/1000)}));},1000);},[s.elapsed]);
  const pause=useCallback(()=>{if(iv.current)clearInterval(iv.current);pe.current=s.elapsed;setS(p=>({...p,isPaused:true,isRunning:false}));},[s.elapsed]);
  const resume=useCallback(()=>{st.current=Date.now();setS(p=>({...p,isPaused:false,isRunning:true}));iv.current=setInterval(()=>{setS(p=>({...p,elapsed:pe.current+Math.floor((Date.now()-st.current)/1000)}));},1000);},[]);
  const stop=useCallback(()=>{if(iv.current)clearInterval(iv.current);const f=s.elapsed;setS({isRunning:false,isPaused:false,elapsed:0});pe.current=0;return f;},[s.elapsed]);
  const reset=useCallback(()=>{if(iv.current)clearInterval(iv.current);setS({isRunning:false,isPaused:false,elapsed:0});pe.current=0;},[]);
  useEffect(()=>()=>{if(iv.current)clearInterval(iv.current);},[]); return {...s,start,pause,resume,stop,reset}; }
function fmtDur(sec:number):string{const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}

const SECTIONS=[{key:"english",label:"英语",color:"text-blue-600",bg:"bg-blue-50",border:"border-blue-200"},{key:"dental",label:"专业课",color:"text-emerald-600",bg:"bg-emerald-50",border:"border-emerald-200"},{key:"other",label:"其它",color:"text-amber-600",bg:"bg-amber-50",border:"border-amber-200"}] as const;

function TimerModal({isOpen,onClose,taskName,onSave}:{isOpen:boolean;onClose:()=>void;taskName:string;onSave:(mins:number)=>void}){
  const t=useTimer();const[acc,setAcc]=useState(0);if(!isOpen)return null;
  const handleStop=()=>{const secs=t.stop();setAcc(a=>a+Math.round(secs/60));};
  return(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div className="bg-background rounded-2xl shadow-2xl p-8 w-full max-w-md text-center space-y-6" onClick={e=>e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-muted-foreground">{taskName}</h3><div className="text-7xl font-mono font-bold tracking-wider py-4">{fmtDur(t.elapsed)}</div>
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

export default function DailyPlanPage(){
  const[date,setDate]=useState(dayjs().format("YYYY-MM-DD"));const[plan,setPlan]=useState<DailyPlan|null>(null);
  const[saved,setSaved]=useState(false);const[collapsed,setCollapsed]=useState<Record<string,boolean>>({english:false,dental:false,other:false});
  const[timerOpen,setTimerOpen]=useState(false);const[timerTaskIdx,setTimerTaskIdx]=useState(-1);
  const[customSchedules,setCustomSchedules]=useState<{date:string;weekday:string;gym:string;tasks:{text:string;category:"english"|"dental"|"other"}[]}[]>([]);
  const[taskTemplates,setTaskTemplates]=useState<{id:string;text:string;category:"english"|"dental"|"other";plannedMinutes:number}[]>([]);
  const[templatePickerOpen,setTemplatePickerOpen]=useState(false);const[templatePickerCat,setTemplatePickerCat]=useState<"english"|"dental"|"other">("other");
  const[completionOpen,setCompletionOpen]=useState(false);const[completionTaskIdx,setCompletionTaskIdx]=useState(-1);
  const[showSchedule,setShowSchedule]=useState(false);const[datesWithData,setDatesWithData]=useState<Set<string>>(new Set());

  const loadCS=useCallback(async()=>{setCustomSchedules(await getCustomSchedules());},[]);
  useEffect(()=>{loadCS();},[loadCS]);useEffect(()=>{getTaskTemplates().then(d=>setTaskTemplates(d as any));},[]);
  const getEffectiveSchedule=useCallback((d:string)=>{const c=customSchedules.find(s=>s.date===d);return c||STUDY_SCHEDULE.find(s=>s.date===d);},[customSchedules]);

  const loadPlan=useCallback(async()=>{
    const existing=await getDailyPlan(date);const sched=getEffectiveSchedule(date);
    if(existing)setPlan(existing);
    else if(sched){const tasks:Task[]=sched.tasks.map((t,i)=>({id:`${date}-${i}`,text:t.text,category:t.category,status:"pending",plannedMinutes:30,actualMinutes:0,timerAccumulated:0}));setPlan({date,tasks,conquered:"",difficulty:"",adjust:"",completion:"",totalFocusMinutes:0});}
    else setPlan({date,tasks:[],conquered:"",difficulty:"",adjust:"",completion:"",totalFocusMinutes:0});
  },[date,getEffectiveSchedule]);
  useEffect(()=>{loadPlan();},[loadPlan]);

  const updateTask=(idx:number,task:Task)=>{if(!plan)return;const tasks=[...plan.tasks];tasks[idx]=task;const tf=tasks.reduce((s,t)=>s+(t.actualMinutes||0),0);setPlan({...plan,tasks,totalFocusMinutes:tf});};
  const addTask=(cat:"english"|"dental"|"other",template?:{text:string;category:string;plannedMinutes:number})=>{if(!plan)return;setPlan({...plan,tasks:[...plan.tasks,{id:`${date}-${plan.tasks.length}-${Date.now()}`,text:template?.text||"",category:template?.category as any||cat,status:"pending",plannedMinutes:template?.plannedMinutes||30,actualMinutes:0,timerAccumulated:0}]});};
  const removeTask=(idx:number)=>{if(!plan)return;const tasks=plan.tasks.filter((_,i)=>i!==idx);const tf=tasks.reduce((s,t)=>s+(t.actualMinutes||0),0);setPlan({...plan,tasks,totalFocusMinutes:tf});};
  const openTimer=(idx:number)=>{setTimerTaskIdx(idx);setTimerOpen(true);};
  const handleTimerSave=(mins:number)=>{if(!plan||timerTaskIdx<0)return;const t=plan.tasks[timerTaskIdx];updateTask(timerTaskIdx,{...t,actualMinutes:(t.actualMinutes||0)+mins});};

  const openCompletionModal=(idx:number)=>{setCompletionTaskIdx(idx);setCompletionOpen(true);};
  const handleCompletionSave=(rate:number,reason:string)=>{if(!plan||completionTaskIdx<0)return;const t=plan.tasks[completionTaskIdx];const am=(t.actualMinutes||0)===0?t.plannedMinutes:t.actualMinutes;updateTask(completionTaskIdx,{...t,actualMinutes:am,completionRate:rate,reason,status:"completed"});setCompletionOpen(false);};

  const save=async()=>{if(!plan)return;await saveDailyPlan(plan);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const saveAsTemplate=async(t:Task)=>{if(!t.text.trim()){alert("任务名称不能为空");return;}await saveTaskTemplate({id:`template-${Date.now()}`,text:t.text,category:t.category,plannedMinutes:t.plannedMinutes||30});setTaskTemplates(await getTaskTemplates() as any);alert("✅ 已保存任务模板: "+t.text);};
  const openTemplatePicker=(cat:"english"|"dental"|"other")=>{setTemplatePickerCat(cat);getTaskTemplates().then(d=>setTaskTemplates(d as any));setTemplatePickerOpen(true);};

  const getTasksByCat=(cat:string)=>plan?.tasks.filter(t=>t.category===cat)||[];
  const getTaskIdx=(cat:string,idxInCat:number)=>{let cnt=0;for(let i=0;i<(plan?.tasks.length||0);i++){if(plan!.tasks[i].category===cat){if(cnt===idxInCat)return i;cnt++;}}return -1;};
  const doneCount=plan?.tasks.filter(t=>t.status==="completed").length||0;
  const totalCount=plan?.tasks.length||0;

  return <div className="space-y-6">
    <h1 className="font-heading text-2xl">每日学习</h1>
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={()=>setDate(d=>dayjs(d).subtract(1,"day").format("YYYY-MM-DD"))}><ChevronLeft className="w-4 h-4"/></Button>
      <Input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-auto h-9"/>
      <Button variant="outline" size="sm" onClick={()=>setDate(dayjs().format("YYYY-MM-DD"))}>今天</Button>
      <Button variant="outline" size="sm" onClick={()=>setDate(d=>dayjs(d).add(1,"day").format("YYYY-MM-DD"))}><ChevronRight className="w-4 h-4"/></Button>
      <Button variant="outline" size="sm" onClick={async()=>{if(!showSchedule){const all=await getAllDailyPlans();setDatesWithData(new Set(all.map((p:any)=>p.date)));}setShowSchedule(!showSchedule);}}>📋 {showSchedule?"隐藏日程":"学习日程"}</Button>
      <Button onClick={save} className="ml-auto">{saved?"✅ 已保存":"💾 保存"}</Button>
    </div>

    {showSchedule&&(()=>{const start=dayjs("2026-05-05");const end=dayjs().add(14,"day");const days:string[]=[];let d=start;while(d.isBefore(end)||d.isSame(end,"day")){days.push(d.format("YYYY-MM-DD"));d=d.add(1,"day");}
      return <Card><CardHeader className="pb-3"><CardTitle className="text-base">学习日程 ({dayjs(days[0]).format("M/D")} - {dayjs(days[days.length-1]).format("M/D")})</CardTitle></CardHeader><CardContent>
        <div className="grid grid-cols-5 md:grid-cols-7 gap-1 text-xs">{days.map(dd=>{const hasData=datesWithData.has(dd);const isToday=dd===dayjs().format("YYYY-MM-DD");
          return <button key={dd} onClick={()=>{setDate(dd);setShowSchedule(false);}} className={`p-2 rounded-md text-center border transition-colors ${isToday?"border-primary bg-primary/10 font-semibold":hasData?"border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100":"border-gray-200 bg-white hover:bg-muted"}`}>
            <div className="text-[10px]">{dayjs(dd).format("ddd")}</div><div className="text-[11px] font-medium">{dd.slice(5)}</div><div className="text-[10px] mt-0.5">{hasData?<span className="text-emerald-600">● 有数据</span>:<span className="text-gray-300">○</span>}</div>
          </button>;})}</div>
      </CardContent></Card>;})()}

    <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center justify-between">每日结果计划表<span className="text-sm font-normal text-muted-foreground">{doneCount}/{totalCount} 完成</span></CardTitle></CardHeader>
      <CardContent className="space-y-4"><Progress value={doneCount} max={totalCount||1} className="h-2"/>
        {SECTIONS.map(sec=>{const tasks=getTasksByCat(sec.key);return <div key={sec.key} className={`border rounded-lg ${sec.border}`}>
          <button onClick={()=>setCollapsed(c=>({...c,[sec.key]:!c[sec.key]}))} className={`w-full flex items-center justify-between p-3 ${sec.bg} rounded-t-lg`}>
            <span className={`font-semibold ${sec.color}`}>{sec.label} ({tasks.length})</span>{collapsed[sec.key]?<ChevronDown className="w-4 h-4"/>:<ChevronUp className="w-4 h-4"/>}</button>
          {!collapsed[sec.key]&&<div className="p-3 space-y-3">
            {tasks.map((task,idxInCat)=>{const gi=getTaskIdx(sec.key,idxInCat);
              return <div key={gi} className="border rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={task.status==="completed"} onChange={e=>{if(e.target.checked)openCompletionModal(gi);else updateTask(gi,{...task,status:"pending",completionRate:undefined});}} className="mt-2 w-4 h-4 accent-primary shrink-0"/>
                  <div className="flex-1 space-y-2">
                    <Input value={task.text} onChange={e=>updateTask(gi,{...task,text:e.target.value})} placeholder={`${sec.label}任务`} className={task.status==="completed"?"line-through opacity-60":""}/>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={task.status} onChange={e=>{const ns=e.target.value as Task["status"];if(ns==="completed")openCompletionModal(gi);else updateTask(gi,{...task,status:ns});}} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="pending">⬜ 待做</option><option value="doing">🔥 进行中</option><option value="completed">✅ 完成</option><option value="failed">❌ 未完成</option></select>
                      <Button variant="ghost" size="sm" onClick={()=>openTimer(gi)}><Clock className="w-4 h-4 mr-1"/>计时</Button>
                      <Input type="number" placeholder="耗时(min)" className="w-24 h-9 text-sm" value={task.actualMinutes??""} onChange={e=>{const v=e.target.value;updateTask(gi,{...task,actualMinutes:v===""?0:parseInt(v)||0});}}/>
                      <Input type="number" placeholder="预计(min)" className="w-20 h-9 text-sm" value={task.plannedMinutes??""} onChange={e=>{const v=e.target.value;updateTask(gi,{...task,plannedMinutes:v===""?0:parseInt(v)||0});}}/>
                      {task.completionRate!==undefined&&<span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">完成度 {task.completionRate}%</span>}
                      {task.reason&&<span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 truncate max-w-[100px]" title={task.reason}>{task.reason}</span>}
                    </div></div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={()=>removeTask(gi)}><X className="w-4 h-4"/></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" title="保存为模板" onClick={()=>saveAsTemplate(task)}>💾</Button>
                  </div></div></div>;})}
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>addTask(sec.key)} className="flex-1">+ 添加{sec.label}任务</Button><Button variant="outline" size="sm" onClick={()=>openTemplatePicker(sec.key)} className="flex-1">📋 从模板添加</Button></div>
          </div>}</div>;})}
        <Textarea placeholder="完成✅+耗时 & 未完成❌+耗时+原因" value={plan?.completion||""} onChange={e=>plan&&setPlan({...plan,completion:e.target.value})}/>
      </CardContent></Card>

    <Card><CardHeader className="pb-3"><CardTitle className="text-base">今日战果复盘</CardTitle></CardHeader><CardContent className="space-y-4">
      <div><label className="text-sm font-medium">攻克（今天具体学会了什么？）</label><Textarea value={plan?.conquered||""} onChange={e=>plan&&setPlan({...plan,conquered:e.target.value})} placeholder="具体、可检验的成果"/></div>
      <div><label className="text-sm font-medium">难点（哪个知识点卡住了？）</label><Textarea value={plan?.difficulty||""} onChange={e=>plan&&setPlan({...plan,difficulty:e.target.value})} placeholder="卡住的点 + 卡了多久"/></div>
      <div><label className="text-sm font-medium">调整（明天减少/增加任务量，还是改变方法？）</label><Textarea value={plan?.adjust||""} onChange={e=>plan&&setPlan({...plan,adjust:e.target.value})} placeholder="具体的调整方案"/></div>
    </CardContent></Card>

    <div className="text-sm text-muted-foreground">今日总专注时长: <span className="font-semibold text-foreground">{plan?.totalFocusMinutes||0} 分钟</span></div>

    {templatePickerOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setTemplatePickerOpen(false)}>
      <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">选择任务模板 ({SECTIONS.find(s=>s.key===templatePickerCat)?.label})</h3>
        {taskTemplates.filter(t=>t.category===templatePickerCat).length===0?<p className="text-muted-foreground text-sm">暂无模板，先创建一个任务并点击 💾 保存为模板</p>
          :<div className="space-y-2 mb-4">{taskTemplates.filter(t=>t.category===templatePickerCat).map(tpl=>(<div key={tpl.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted">
            <div className="flex-1"><div className="font-medium text-sm">{tpl.text}</div><div className="text-xs text-muted-foreground">预计 {tpl.plannedMinutes} 分钟</div></div>
            <div className="flex gap-1"><Button size="sm" onClick={()=>{addTask(templatePickerCat,{text:tpl.text,category:tpl.category,plannedMinutes:tpl.plannedMinutes});setTemplatePickerOpen(false);}}>添加</Button>
              <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={async()=>{await deleteTaskTemplate(tpl.id);setTaskTemplates(await getTaskTemplates() as any);}}><X className="w-3 h-3"/></Button></div></div>))}</div>}
        <div className="flex justify-end"><Button variant="outline" onClick={()=>setTemplatePickerOpen(false)}>关闭</Button></div></div></div>}

    {completionOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setCompletionOpen(false)}>
      <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">任务完成度</h3>
        {completionTaskIdx>=0&&plan&&<div className="space-y-4">
          <p className="text-sm text-muted-foreground">任务: {plan.tasks[completionTaskIdx].text}</p>
          <div><label className="text-sm font-medium">完成度 (%)</label>
            <input type="range" min="0" max="100" defaultValue={plan.tasks[completionTaskIdx].completionRate??100} className="w-full mt-1" id="completion-rate"/>
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0%</span><span>50%</span><span>100%</span></div></div>
          <div><label className="text-sm font-medium">原因/备注 (可选)</label>
            <input type="text" placeholder="为什么不是100%？或者完成的感受..." className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm" id="completion-reason" defaultValue={plan.tasks[completionTaskIdx].reason||""}/></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setCompletionOpen(false)}>取消</Button>
            <Button onClick={()=>{const ri=(document.getElementById("completion-rate") as HTMLInputElement);const rsn=(document.getElementById("completion-reason") as HTMLInputElement);handleCompletionSave(parseInt(ri?.value||"100"),rsn?.value||"");}}>确认完成</Button></div>
        </div>}</div></div>}

    <TimerModal isOpen={timerOpen} onClose={()=>setTimerOpen(false)} taskName={timerTaskIdx>=0?plan?.tasks[timerTaskIdx]?.text||"任务":"任务"} onSave={handleTimerSave}/>
  </div>;
}
