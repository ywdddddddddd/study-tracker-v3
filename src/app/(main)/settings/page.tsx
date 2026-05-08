"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getOrCreateProfile, updateProfile, type Profile } from "@/lib/db";

const item={hidden:{opacity:0,y:12},show:{opacity:1,y:0,transition:{duration:0.3,ease:"easeOut" as const}}};

export default function SettingsPage(){
  const[profile,setProfile]=useState<Profile|null>(null);
  const[deepseekKey,setDeepseekKey]=useState("");const[deepseekModel,setDeepseekModel]=useState("");
  const[siliconKey,setSiliconKey]=useState("");const[siliconModel,setSiliconModel]=useState("");

  useEffect(()=>{
    getOrCreateProfile().then(setProfile);
    setDeepseekKey(localStorage.getItem("ai_deepseek_key")||"");
    setDeepseekModel(localStorage.getItem("ai_deepseek_model")||"deepseek-v4-pro");
    setSiliconKey(localStorage.getItem("ai_silicon_key")||"");
    setSiliconModel(localStorage.getItem("ai_silicon_model")||"deepseek-ai/DeepSeek-R1");
  },[]);

  async function handleSaveProfile(){if(!profile)return;try{await updateProfile(profile);toast.success("资料已保存");}catch(e){toast.error("保存失败");}}
  function handleSaveAI(){localStorage.setItem("ai_deepseek_key",deepseekKey);localStorage.setItem("ai_deepseek_model",deepseekModel);localStorage.setItem("ai_silicon_key",siliconKey);localStorage.setItem("ai_silicon_model",siliconModel);toast.success("AI 设置已保存");}
  const update=(f:keyof Profile,v:any)=>{if(!profile)return;setProfile({...profile,[f]:v});};

  return <div className="space-y-6 max-w-xl">
    <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><h1 className="font-heading text-2xl">设置</h1></motion.div>

    <motion.div variants={item} initial="hidden" animate="show">
      <Card><CardHeader><CardTitle className="text-base">个人资料</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs mb-1">身高 (cm)</Label><Input type="number" value={profile?.height||""} onChange={e=>update("height",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">体重 (kg)</Label><Input type="number" value={profile?.weight||""} onChange={e=>update("weight",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">年龄</Label><Input type="number" value={profile?.age||""} onChange={e=>update("age",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">性别</Label><Select value={profile?.gender||"male"} onValueChange={(v)=>update("gender",v||"male")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="male">男</SelectItem><SelectItem value="female">女</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs mb-1">目标体重 (kg)</Label><Input type="number" value={profile?.targetWeight||""} onChange={e=>update("targetWeight",Number(e.target.value))}/></div>
          <div><Label className="text-xs mb-1">目标体脂 (%)</Label><Input type="number" value={profile?.targetBodyFat||""} onChange={e=>update("targetBodyFat",Number(e.target.value))}/></div>
          <div className="col-span-2"><Label className="text-xs mb-1">目标日期</Label><Input type="date" value={profile?.targetDate||""} onChange={e=>update("targetDate",e.target.value)}/></div>
        </div>
        <Button onClick={handleSaveProfile} className="w-full">保存资料</Button>
      </CardContent></Card>
    </motion.div>

    <Separator/>

    <motion.div variants={item} initial="hidden" animate="show">
      <Card><CardHeader><CardTitle className="text-base">AI 模型配置</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">DeepSeek V4 Pro (主模型)</h4>
          <div><Label className="text-xs mb-1">API Key</Label><Input type="password" value={deepseekKey} onChange={e=>setDeepseekKey(e.target.value)} placeholder="sk-..."/></div>
          <div><Label className="text-xs mb-1">模型</Label><Select value={deepseekModel} onValueChange={(v)=>setDeepseekModel(v||"deepseek-v4-pro")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="deepseek-v4-pro">deepseek-v4-pro</SelectItem><SelectItem value="deepseek-chat">deepseek-chat</SelectItem></SelectContent></Select></div>
        </div>
        <div className="space-y-3 pt-2 border-t">
          <h4 className="text-sm font-medium text-muted-foreground">SiliconFlow (备用)</h4>
          <div><Label className="text-xs mb-1">API Key</Label><Input type="password" value={siliconKey} onChange={e=>setSiliconKey(e.target.value)} placeholder="sk-..."/></div>
          <div><Label className="text-xs mb-1">模型</Label><Select value={siliconModel} onValueChange={(v)=>setSiliconModel(v||"deepseek-ai/DeepSeek-R1")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="deepseek-ai/DeepSeek-R1">DeepSeek-R1</SelectItem><SelectItem value="deepseek-ai/DeepSeek-V3">DeepSeek-V3</SelectItem></SelectContent></Select></div>
        </div>
        <Button onClick={handleSaveAI} variant="secondary" className="w-full">保存 AI 设置</Button>
      </CardContent></Card>
    </motion.div>
  </div>;
}
