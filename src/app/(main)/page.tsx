"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { Target, Flame, UtensilsCrossed, Dumbbell, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type DailyPlan, type Profile, type WorkoutLog, getOrCreateProfile, calculateMacros, getDailyPlan, getAllDailyPlans, getFoodEntries, getWorkoutLog } from "@/lib/db";
import { STUDY_SCHEDULE } from "@/data/presets";

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let ct = 0; for (const ex of w.exercises) { if (ex.kind === "cardio" && ex.cardioParams) { const s=ex.cardioParams.speed||0, inc=ex.cardioParams.incline||0, dur=ex.cardioParams.duration||0; ct += ((s*0.2+inc*0.9+3.5)/3.5)*weightKg*(dur/60); } }
  const cd = w.exercises.filter(e=>e.kind==="cardio").reduce((s,e)=>s+(e.cardioParams?.duration||0),0);
  const sd = Math.max(0,(w.duration||0)-cd);
  return Math.round(ct + (sd>0?4.5*weightKg*(sd/60):0));
}
function calcBMR(w:number,h:number,a:number,g:string):number { return Math.round(g==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161); }

const container={hidden:{opacity:0},show:{opacity:1,transition:{staggerChildren:0.06}}};
const item={hidden:{opacity:0,y:16},show:{opacity:1,y:0,transition:{duration:0.4,ease:"easeOut" as const}}};
const catColor=(c:string)=>c==="english"?"text-blue-600 bg-blue-50":c==="dental"?"text-emerald-600 bg-emerald-50":"text-amber-600 bg-amber-50";
const catLabel=(c:string)=>c==="english"?"英语":c==="dental"?"专业课":"其它";

export default function DashboardPage() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [todayPlan,setTodayPlan]=useState<DailyPlan|null>(null);
  const [stats,setStats]=useState({completed:0,total:0,rate:0,streak:0});
  const [foodTotal,setFoodTotal]=useState({calories:0,protein:0,carbs:0,fat:0});
  const [workoutBurn,setWorkoutBurn]=useState(0);
  const today=dayjs().format("YYYY-MM-DD");

  useEffect(()=>{loadData();},[]);
  async function loadData(){
    const p=await getOrCreateProfile();setProfile(p);
    const plan=await getDailyPlan(today);setTodayPlan(plan||null);
    const [allPlans,foods,workout]=await Promise.all([getAllDailyPlans(),getFoodEntries(today),getWorkoutLog(today)]);
    let completed=0,total=0;allPlans.forEach(dp=>dp.tasks.forEach(t=>{total++;if(t.status==="completed")completed++;}));
    const rate=total>0?Math.round((completed/total)*100):0;
    let streak=0;const dates=allPlans.map(dp=>dp.date).sort();
    for(let i=dates.length-1;i>=0;i--){const dp=allPlans.find(p=>p.date===dates[i]);const done=dp?.tasks.filter(t=>t.status==="completed").length||0;if(done>=3)streak++;else if(dates[i]<today)break;}
    setStats({completed,total,rate,streak});
    const ft=foods.reduce((a,e)=>({calories:a.calories+e.calories,protein:a.protein+e.protein,carbs:a.carbs+e.carbs,fat:a.fat+e.fat}),{calories:0,protein:0,carbs:0,fat:0});setFoodTotal(ft);
    if(workout)setWorkoutBurn(calcWorkoutBurn(workout,p.weight));else setWorkoutBurn(0);
  }
  const scheduleToday=STUDY_SCHEDULE.find(s=>s.date===today);
  const todayDone=todayPlan?.tasks.filter(t=>t.status==="completed").length||0;
  const todayTotal=todayPlan?.tasks.length||0;
  const macros=profile?calculateMacros(profile):{calories:1900,protein:154,carbs:156,fat:63};
  const bmr=profile?calcBMR(profile.weight,profile.height,profile.age,profile.gender):1900;
  const totalBurn=workoutBurn+bmr;
  const gymType=scheduleToday?.gym||"休";

  return (<div className="space-y-6">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><h1 className="font-heading text-2xl">仪表盘</h1><p className="text-sm text-muted-foreground mt-1">{dayjs().format("M月D日 ddd")}</p></motion.div>
    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[{title:"已完成任务",value:stats.completed,sub:`共 ${stats.total} 项`,icon:Target},
        {title:"完成率",value:`${stats.rate}%`,sub:``,icon:TrendingUp},
        {title:"连续打卡",value:`${stats.streak} 天`,sub:"",icon:Activity},
        {title:"当前体重",value:`${profile?.weight||"-"} kg`,sub:`目标 ${profile?.targetWeight||"-"} kg`,icon:Dumbbell}].map((s,i)=>(
        <motion.div key={s.title} variants={item}><Card className="hover:shadow-sm transition-shadow"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><s.icon className="h-4 w-4 text-primary"/>{s.title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-display">{s.value}</div><p className="text-xs text-muted-foreground">{s.sub}</p></CardContent></Card></motion.div>
      ))}</motion.div>
    <motion.div variants={item} initial="hidden" animate="show">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">今日概览 ({dayjs().format("M月D日")})</CardTitle></CardHeader><CardContent className="space-y-4">
        {todayPlan&&todayPlan.tasks.length>0?<>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium">健身:</span>
            <Badge variant={gymType==="休"?"outline":"default"}>{gymType==="推"?"推 (胸+肩+三头)":gymType==="拉"?"拉 (背+肩后束+二头)":gymType==="腿"?"腿 (股四+腘绳+臀)":"休息日"}</Badge></div>
          <div><p className="text-sm font-medium mb-2">今日任务:</p><ul className="text-sm space-y-1.5">{todayPlan.tasks.map((t,i)=>(
            <li key={i} className="flex items-start gap-2"><span className="shrink-0 mt-0.5">{t.status==="completed"?"✅":t.status==="failed"?"❌":t.status==="doing"?"🔥":"⬜"}</span>
              <span className={`min-w-0 flex-1 ${t.status==="completed"?"line-through opacity-60":""}`}>{t.text}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${catColor(t.category)}`}>{catLabel(t.category)}</span></li>))}</ul></div>
          <div><div className="flex justify-between text-sm mb-1"><span>今日进度</span><span className="font-medium">{todayDone}/{todayTotal}</span></div><Progress value={todayDone} max={todayTotal||1} className="h-2"/></div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div className="rounded-lg bg-blue-50/50 p-3"><p className="text-xs text-muted-foreground mb-1">今日饮食</p><p className="text-sm font-semibold text-blue-600">{foodTotal.calories}/{macros.calories} kcal</p><p className="text-[10px] text-muted-foreground mt-0.5">P:{foodTotal.protein.toFixed(1)}g C:{foodTotal.carbs.toFixed(1)}g F:{foodTotal.fat.toFixed(1)}g</p></div>
            <div className="rounded-lg bg-orange-50/50 p-3"><p className="text-xs text-muted-foreground mb-1">今日消耗</p><p className="text-sm font-semibold text-orange-600">{totalBurn} kcal</p><p className="text-[10px] text-muted-foreground mt-0.5">运动{workoutBurn} + BMR{bmr}</p><p className={`text-[10px] font-medium mt-0.5 ${totalBurn-foodTotal.calories>=0?"text-emerald-600":"text-red-600"}`}>缺口: {totalBurn-foodTotal.calories} kcal</p></div></div>
        </>:<p className="text-muted-foreground text-center py-6">今天暂无任务记录，请前往「每日计划」添加。</p>}
      </CardContent></Card></motion.div>
  </div>);
}
