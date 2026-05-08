"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import { Sparkles, Brain, Calendar, Send, CheckSquare, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getOrCreateProfile, calculateMacros, type Task, type FoodEntry, getDailyPlan, saveDailyPlan, getDailyPlansInRange, getFoodEntries, getWorkoutLog, getWeightRecords, getSleepRecords, getFoodEntriesInRange, getWorkoutLogsInRange, getWeeklyReview, getGymSchedules, type WorkoutLog } from "@/lib/db";
import { GYM_SCHEDULE } from "@/data/presets";

const PRIMARY_URL="https://api.deepseek.com/chat/completions";
const PRIMARY_KEY="sk-0fb0a98da71a46388a7701b842ecd438";
const PRIMARY_MODEL="deepseek-v4-pro";
const FALLBACK_URL="https://api.siliconflow.cn/v1/chat/completions";
const FALLBACK_KEY="sk-lldpkkegjmpexefnwqijwkouvijszfnuzamqxofutkkzirro";
const FALLBACK_MODEL="deepseek-ai/DeepSeek-R1";

const SYSTEM_PROMPT=`你是wen的AI日程助手，精通学习科学、运动营养学和认知心理学。

你的能力：
1. /饮食 — 分析饮食摄入数据，诊断营养问题，给出具体餐食建议
2. /健身 — 分析训练数据，评估渐进超负荷，给出训练调整建议
3. /学习 — 分析学习效率，诊断低效根源，给出学习方法优化
4. /日程 — 基于本周预算配额，生成优化后的明日/下周完整安排
5. /日 or /周 — 日常/周度综合总结分析
6. /分析 — 全链条分析：饮食→健身→学习→日程安排，聚合后再执行

分析原则：
- 学习：关注"提取率"而非"投入时长"
- 健身：关注"渐进超负荷"
- 饮食：关注"热量赤字+蛋白质达标"，蛋白质按每公斤目标体重2.2g
- 体重：关注周趋势而非日波动

输出要求：
- 用Markdown格式，分结构清晰的章节
- 生成日程时，每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式
- 饮食建议具体到每餐的食物和数量
- 训练安排参考健身日程表`;

function calcBMR(w:number,h:number,a:number,g:string):number{return Math.round(g==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161);}
function calcWorkoutBurn(w:WorkoutLog,kg:number):number{let ct=0;for(const ex of w.exercises){if(ex.kind==="cardio"&&ex.cardioParams){const s=ex.cardioParams.speed||0,i=ex.cardioParams.incline||0,d=ex.cardioParams.duration||0;ct+=((s*0.2+i*0.9+3.5)/3.5)*kg*(d/60);}}const cd=w.exercises.filter(e=>e.kind==="cardio").reduce((s,e)=>s+(e.cardioParams?.duration||0),0);const sd=Math.max(0,(w.duration||0)-cd);return Math.round(ct+(sd>0?4.5*kg*(sd/60):0));}

function parseTasks(text:string):Task[]{const tasks:Task[]=[];const seen=new Set<string>();const lines=text.split("\n");
  for(const line of lines){let m:RegExpMatchArray|null=null;
    m=line.match(/[「【]([^|｜]+)[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)[」\]】]/i);
    if(!m)m=line.match(/^\s*[-*]\s*(.+?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/i);
    if(!m)m=line.match(/^(\S.{2,}?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/i);
    if(m){const name=m[1].trim();const cat=m[2].toLowerCase();const mins=parseInt(m[3]);const key=`${name}|${cat}`;if(!seen.has(key)&&mins>0){seen.add(key);tasks.push({id:`ai-${Date.now()}-${tasks.length}`,text:name,category:cat as any,status:"pending",plannedMinutes:mins,actualMinutes:0,timerAccumulated:0});}}}
  return tasks;}

const ml:{[k:string]:string}={breakfast:"早餐",lunch:"午餐",dinner:"晚餐",snack:"加餐"};
const ffs=(entries:FoodEntry[],label:string)=>{if(entries.length===0)return`${label}: 无记录`;const bm:Record<string,FoodEntry[]>={};for(const f of entries){if(!bm[f.meal])bm[f.meal]=[];bm[f.meal].push(f);}return Object.entries(bm).map(([m,items])=>{const t=items.reduce((s,e)=>s+e.calories,0);return`${ml[m]||m} (${t}kcal):\n${items.map(e=>`  - ${e.name} ${e.weight}g (${e.calories}kcal, P${e.protein}g C${e.carbs}g F${e.fat}g)`).join("\n")}`;}).join("\n")||`${label}: 无记录`;};

export default function AIPage(){
  const[convs,setConvs]=useState<{role:"user"|"assistant";content:string;reasoning?:string}[]>([]);
  const[adoptOpen,setAdoptOpen]=useState(false);const[suggestedTasks,setSuggestedTasks]=useState<Task[]>([]);
  const[selectedTasks,setSelectedTasks]=useState<Set<number>>(new Set());
  const[showReasoning,setShowReasoning]=useState<Set<number>>(new Set());
  const[isLoading,setIsLoading]=useState(false);
  const[streamContent,setStreamContent]=useState("");const[streamReasoning,setStreamReasoning]=useState("");
  const scrollRef=useRef<HTMLDivElement>(null);const abortRef=useRef<AbortController|null>(null);
  const[dataStart,setDataStart]=useState("2026-05-05");
  const[dataEnd,setDataEnd]=useState(dayjs().format("YYYY-MM-DD"));
  const[scope,setScope]=useState<"day"|"week">("day");
  const[userInput,setUserInput]=useState("");

  useEffect(()=>{scrollRef.current?.scrollIntoView({behavior:"smooth"});},[convs]);

  async function gatherContext():Promise<string>{
    const today=dayjs().format("YYYY-MM-DD");const yesterday=dayjs().subtract(1,"day").format("YYYY-MM-DD");const twoDaysAgo=dayjs().subtract(2,"day").format("YYYY-MM-DD");
    const [profile,todayPlan,rangePlans,foodEntries,workoutLogs,yesterdayFoods,twoDaysAgoFoods,rangeFoodEntries,rangeWorkouts,weightRecords,sleepRecords,weekReview,gymOverrides]=await Promise.all([
      getOrCreateProfile(),getDailyPlan(today),getDailyPlansInRange(dataStart,dataEnd),getFoodEntries(today),getWorkoutLog(today),
      getFoodEntries(yesterday),getFoodEntries(twoDaysAgo),getFoodEntriesInRange(dataStart,dataEnd),getWorkoutLogsInRange(dataStart,dataEnd),
      getWeightRecords("desc").then(a=>a.slice(0,14)),getSleepRecords(14).then(a=>a.reverse()),
      getWeeklyReview(dayjs().startOf("week").add(1,"day").format("YYYY-MM-DD")),getGymSchedules().catch(()=>[]),
    ]);
    const macros=calculateMacros(profile);const bmr=calcBMR(profile.weight,profile.height,profile.age,profile.gender);
    const ft=(es:FoodEntry[])=>es.reduce((a,e)=>({c:a.c+e.calories,p:a.p+e.protein,f:a.f+e.fat,cb:a.cb+e.carbs}),{c:0,p:0,f:0,cb:0});
    const ftToday=ft(foodEntries);const wb=workoutLogs?calcWorkoutBurn(workoutLogs,profile.weight):0;
    const rangeFT=ft(rangeFoodEntries);const rangeWB=rangeWorkouts.reduce((s:number,w:WorkoutLog)=>s+calcWorkoutBurn(w,profile.weight),0);
    const om:Record<string,string>={};for(const o of gymOverrides)om[o.date]=o.gym;
    const gymText=GYM_SCHEDULE.slice(0,7).map(s=>`- ${s.date} ${s.weekday}: ${om[s.date]||s.gym}`).join("\n");
    const catB:Record<string,number>={dental:(weekReview?.budgetDental||10.5)*60,english:(weekReview?.budgetEnglish||7)*60,other:(weekReview?.budgetReview||2)*60};
    const catU:Record<string,number>={dental:0,english:0,other:0};for(const p of rangePlans)for(const t of p.tasks)if(t.status==="completed")catU[t.category]=(catU[t.category]||0)+(t.actualMinutes||0);
    const dr=Math.max(1,7-rangePlans.length);
    const budgetLines=["dental","english","other"].map(cat=>`- ${cat==="dental"?"专业课":cat==="english"?"英语":"其它"}: 已用${Math.round(catU[cat]||0)}min/${catB[cat]||0}min, 剩余${Math.max(0,(catB[cat]||0)-Math.round(catU[cat]||0))}min, 建议每日${Math.round(Math.max(0,(catB[cat]||0)-Math.round(catU[cat]||0))/dr)}min`).join("\n");
    const wt=weightRecords.length>=2?weightRecords[weightRecords.length-1].weight-weightRecords[0].weight:0;
    return `=== 用户档案 ===\n性别：${profile.gender==="male"?"男":"女"}，年龄${profile.age}岁，身高${profile.height}cm，当前体重${profile.weight}kg\n目标体重：${profile.targetWeight}kg，目标体脂：${profile.targetBodyFat}%\nBMR：${bmr} kcal/天，目标热量：${macros.calories}kcal，P${macros.protein}g C${macros.carbs}g F${macros.fat}g\n\n=== 健身日程表（近7天）===\n${gymText}\n\n=== 今日学习(${today}) ===\n${todayPlan?todayPlan.tasks.map((t:Task)=>`- ${t.text}: ${t.status==="completed"?"✅":t.status==="failed"?"❌":"⬜"} 效率${t.completionRate!==undefined?`${t.completionRate}%`:t.status==="completed"?"100%":"N/A"} 实际${t.actualMinutes}min/预计${t.plannedMinutes}min${t.reason?` [${t.reason}]`:""}`).join("\n"):"无记录"}\n总专注：${todayPlan?.totalFocusMinutes||0}min | 复盘：${todayPlan?.conquered||"无"} | 难点：${todayPlan?.difficulty||"无"}\n\n=== 今日饮食 ===\n${ffs(foodEntries,"今日")}\n今日总计：${ftToday.c}kcal P${ftToday.p.toFixed(1)} C${ftToday.cb.toFixed(1)} F${ftToday.f.toFixed(1)}\n目标：${macros.calories}kcal P${macros.protein}g C${macros.carbs}g F${macros.fat}g\n\n=== 昨日饮食(${yesterday}) ===\n${ffs(yesterdayFoods,"昨日")}\n\n=== 前日饮食(${twoDaysAgo}) ===\n${ffs(twoDaysAgoFoods,"前日")}\n\n=== 今日训练 ===\n${workoutLogs?`类型：${workoutLogs.type}，时长${workoutLogs.duration}min，运动消耗${wb}kcal，总消耗${wb+bmr}kcal\n动作：\n${workoutLogs.exercises.map(ex=>ex.kind==="cardio"?`  - ${ex.name}: 有氧 ${ex.cardioParams?.duration||0}min @${ex.cardioParams?.speed||0}km/h`:`  - ${ex.name}: 力量 ${ex.sets.length}组 (${ex.sets.map(s=>`${s.reps}次${s.weight>0?`${s.weight}kg`:""}`).join(", ")})`).join("\n")}`:"无训练记录"}\n\n=== 范围统计(${dataStart}~${dataEnd}) ===\n记录：${rangePlans.length}天 | 完成任务：${rangePlans.reduce((s,p)=>s+p.tasks.filter(t=>t.status==="completed").length,0)} | 失败：${rangePlans.reduce((s,p)=>s+p.tasks.filter(t=>t.status==="failed").length,0)}\n总专注：${rangePlans.reduce((s,p)=>s+p.totalFocusMinutes,0)}min\n总摄入：${rangeFT.c}kcal P${rangeFT.p.toFixed(1)} C${rangeFT.cb.toFixed(1)} F${rangeFT.f.toFixed(1)}\n总训练消耗：${rangeWB}kcal | 预估赤字：${rangeWB+bmr*rangePlans.length-rangeFT.c}kcal\n\n=== 本周预算 ===\n${budgetLines}\n目标：${weekReview?.taskGoals||"无"} | 进度：${weekReview?.progressGoals||"无"}\n运动配额：${weekReview?.budgetSport||3.5}h/周\n\n=== 体重（14天）===\n${weightRecords.map(w=>`- ${w.date}: ${w.weight}kg${w.bodyFat?` (体脂${w.bodyFat}%)`:""}`).join("\n")}\n趋势：${wt>0?"↑":wt<0?"↓":"→"} ${Math.abs(wt).toFixed(1)}kg\n\n=== 睡眠（14天）===\n${sleepRecords.map(s=>`- ${s.date}: ${s.bedTime}→${s.wakeTime} ${Math.floor(s.duration/60)}h${s.duration%60}m ★${s.quality}`).join("\n")}\n`;
  }

  const streamChat=useCallback(async(prompt:string)=>{
    const ctx=await gatherContext();const fullPrompt=`${ctx}\n\n用户问题：${prompt}`;
    const body:Record<string,any>={model:PRIMARY_MODEL,messages:[{role:"system",content:SYSTEM_PROMPT},{role:"user",content:fullPrompt}],stream:true,max_tokens:4096,thinking:{type:"enabled"},reasoning_effort:"max"};
    abortRef.current=new AbortController();setIsLoading(true);
    try{
      let content="";let reasoning="";
      setConvs(prev=>[...prev,{role:"assistant",content:"...",reasoning:""}]);
      const tryFetch=async(url:string,key:string,model:string):Promise<Response>=>{
        return fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({...body,model}),signal:abortRef.current!.signal});
      };
      let res=await tryFetch(PRIMARY_URL,PRIMARY_KEY,PRIMARY_MODEL);
      if(!res.ok&&[408,429,402].includes(res.status)){console.warn("Primary failed, trying fallback...");res=await tryFetch(FALLBACK_URL,FALLBACK_KEY,FALLBACK_MODEL);}
      if(!res.ok)throw new Error(`API error: ${res.status}`);
      const reader=res.body?.getReader();if(!reader)throw new Error("No reader");
      const decoder=new TextDecoder();let buffer="";
      while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";
        for(const line of lines){if(!line.startsWith("data: "))continue;const data=line.slice(6);if(data==="[DONE]")continue;
          try{const json=JSON.parse(data);const delta=json.choices?.[0]?.delta;
            if(delta?.reasoning_content){reasoning+=delta.reasoning_content;setConvs(prev=>{const last=prev[prev.length-1];if(last&&last.role==="assistant")return[...prev.slice(0,-1),{role:"assistant",content,reasoning}];return prev;});}
            if(delta?.content){content+=delta.content;setConvs(prev=>{const last=prev[prev.length-1];if(last&&last.role==="assistant")return[...prev.slice(0,-1),{role:"assistant",content,reasoning}];return prev;});}
          }catch{}}
      }
      if(!content&&reasoning){setConvs(prev=>{const last=prev[prev.length-1];if(last&&last.role==="assistant")return[...prev.slice(0,-1),{role:"assistant",content:reasoning,reasoning}];return prev;});}
    }catch(e:any){if(e.name==="AbortError")return;toast.error(`AI连接失败: ${e.message}`);setConvs(prev=>prev.filter(c=>c.content!=="..."));}
    finally{setIsLoading(false);setStreamContent("");setStreamReasoning("");}
  },[]);

  async function handleSend(text?:string){
    const input=text||userInput;if(!input.trim()||isLoading)return;
    setConvs(prev=>[...prev,{role:"user",content:input}]);
    setUserInput("");
    await streamChat(input);
  }

  function handleStop(){abortRef.current?.abort();setIsLoading(false);}
  function toggleReasoning(idx:number){setShowReasoning(prev=>{const n=new Set(prev);if(n.has(idx))n.delete(idx);else n.add(idx);return n;});}

  function adoptTasksFromText(text:string){
    const tasks=parseTasks(text);
    if(tasks.length===0){toast.error("未识别到任务");return;}
    setSuggestedTasks(tasks);setSelectedTasks(new Set(tasks.map((_,i)=>i)));setAdoptOpen(true);
  }
  async function confirmAdopt(){
    const selected=suggestedTasks.filter((_,i)=>selectedTasks.has(i));
    if(selected.length===0)return;
    const today=dayjs().format("YYYY-MM-DD");
    const plan=await getDailyPlan(today);
    const existing=plan?.tasks||[];
    const newTasks=selected.map(t=>({...t,id:`ai-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}));
    await saveDailyPlan({date:today,tasks:[...existing,...newTasks],conquered:plan?.conquered||"",difficulty:plan?.difficulty||"",adjust:plan?.adjust||"",completion:plan?.completion||"",totalFocusMinutes:(plan?.totalFocusMinutes||0)+newTasks.reduce((s,t)=>s+t.plannedMinutes,0)});
    toast.success(`已采纳 ${selected.length} 个任务`);setAdoptOpen(false);
  }

  return <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="flex items-center justify-between shrink-0">
      <div><h1 className="font-heading text-2xl flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>AI 助手</h1><p className="text-sm text-muted-foreground mt-1">DeepSeek V4 Pro · 支持 /饮食 /健身 /学习 /日程 /日 /周 /分析</p></div>
      <div className="flex gap-2">
        <Button variant={scope==="day"?"default":"outline"} size="sm" onClick={()=>setScope("day")}>今日</Button>
        <Button variant={scope==="week"?"default":"outline"} size="sm" onClick={()=>setScope("week")}>本周</Button>
      </div>
    </motion.div>
    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
      {convs.length===0&&<motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-center py-16 text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30"/><p className="text-sm">输入 /学习 或 /日程 开始规划</p>
        <div className="flex gap-1 justify-center mt-3 flex-wrap">{["/饮食","/健身","/学习","/日程","/日","/周","/分析"].map(cmd=><Badge key={cmd} variant="outline" className="cursor-pointer text-xs" onClick={()=>setUserInput(cmd+" ")}>{cmd}</Badge>)}</div>
      </motion.div>}
      {convs.map((msg,i)=>(
        <motion.div key={i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`mb-4 ${msg.role==="user"?"flex justify-end":""}`}>
          <Card className={`max-w-[90%] ${msg.role==="user"?"bg-primary text-primary-foreground":""}`}>
            <CardContent className="p-3">
              {msg.reasoning&&<Collapsible open={showReasoning.has(i)} onOpenChange={()=>toggleReasoning(i)} className="mb-2">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Brain className="h-3 w-3"/>思考过程{showReasoning.has(i)?<ChevronDown className="h-3 w-3"/>:<ChevronRight className="h-3 w-3"/>}</CollapsibleTrigger>
                <CollapsibleContent><div className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">{msg.reasoning}</div></CollapsibleContent>
              </Collapsible>}
              {msg.role==="assistant"?<div className="text-sm prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                :<div className="text-sm whitespace-pre-wrap">{msg.content}</div>}
              {msg.role==="assistant"&&parseTasks(msg.content).length>0&&
                <Button size="sm" variant="outline" className="mt-2" onClick={()=>adoptTasksFromText(msg.content)}><CheckSquare className="h-3 w-3 mr-1"/>采纳 {parseTasks(msg.content).length} 个任务</Button>}
            </CardContent></Card>
        </motion.div>))}
    </ScrollArea>
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="shrink-0">
      <Card><CardContent className="p-3"><div className="flex gap-2">
        <Input value={userInput} onChange={e=>setUserInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}} placeholder="输入消息... (Enter 发送)" disabled={isLoading}/>
        {isLoading?<Button variant="outline" size="icon" onClick={handleStop}><span className="animate-spin">⏳</span></Button>:<Button size="icon" onClick={()=>handleSend()} disabled={!userInput.trim()}><Send className="h-4 w-4"/></Button>}
      </div></CardContent></Card>
    </motion.div>
    <Dialog open={adoptOpen} onOpenChange={setAdoptOpen}><DialogContent className="sm:max-w-md max-h-[70vh] overflow-y-auto"><DialogHeader><DialogTitle>采纳任务 ({selectedTasks.size}/{suggestedTasks.length})</DialogTitle></DialogHeader>
      <div className="space-y-2">{suggestedTasks.map((t,i)=>(<div key={i} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${selectedTasks.has(i)?"bg-accent border-primary":"hover:bg-muted"}`} onClick={()=>{const ns=new Set(selectedTasks);if(ns.has(i))ns.delete(i);else ns.add(i);setSelectedTasks(ns);}}>
        <input type="checkbox" checked={selectedTasks.has(i)} onChange={()=>{}} className="shrink-0"/>
        <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.text}</div><div className="text-xs text-muted-foreground">{t.category==="english"?"英语":t.category==="dental"?"专业课":"其它"} · {t.plannedMinutes}min</div></div>
      </div>))}</div>
      <div className="flex gap-2 justify-end mt-4"><Button variant="outline" onClick={()=>setAdoptOpen(false)}>取消</Button><Button onClick={confirmAdopt} disabled={selectedTasks.size===0}>确认采纳</Button></div>
    </DialogContent></Dialog>
  </div>;
}
