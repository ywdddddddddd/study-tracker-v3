"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UtensilsCrossed, Search, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getFoodEntries,
  addFoodEntry,
  deleteFoodEntry,
  getCustomFoods,
  type FoodEntry,
} from "@/lib/db";
import { FOOD_DATABASE } from "@/data/presets";

const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "protein", label: "蛋白质" },
  { key: "carb", label: "碳水" },
  { key: "veg", label: "蔬菜" },
  { key: "fat", label: "脂肪" },
  { key: "other", label: "其它" },
] as const;

const MEALS = [
  { key: "breakfast", label: "早餐" },
  { key: "lunch", label: "午餐" },
  { key: "dinner", label: "晚餐" },
  { key: "snack", label: "加餐" },
] as const;

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NutritionPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [selectedMeal, setSelectedMeal] = useState<string>("breakfast");
  const today = getToday();

  const [foodDb, setFoodDb] = useState(FOOD_DATABASE);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [foods, customs] = await Promise.all([getFoodEntries(today), getCustomFoods()]);
      setEntries(foods);
      if (customs.length > 0) {
        const customItems = customs.map((c) => ({
          name: c.name, unit: c.unit, gramsPerUnit: c.gramsPerUnit,
          calories: c.calories, protein: c.protein, carbs: c.carbs,
          fat: c.fat, category: c.category as "protein" | "carb" | "veg" | "fat" | "other",
        }));
        setFoodDb([...FOOD_DATABASE, ...customItems]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = foodDb.filter((f) => {
    if (activeCat !== "all" && f.category !== activeCat) return false;
    if (search && !f.name.includes(search)) return false;
    return true;
  });

  async function addFood(food: typeof FOOD_DATABASE[number]) {
    try {
      await addFoodEntry({
        date: today, meal: selectedMeal as "breakfast" | "lunch" | "dinner" | "snack",
        name: food.name, weight: food.gramsPerUnit, calories: food.calories,
        protein: food.protein, carbs: food.carbs, fat: food.fat, isCustom: false,
      });
      toast.success(`已添加 ${food.name}`);
      const foods = await getFoodEntries(today);
      setEntries(foods);
    } catch (e) {
      toast.error("添加失败");
    }
  }

  async function removeEntry(id: number) {
    try {
      await deleteFoodEntry(id);
      toast.success("已删除");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      toast.error("删除失败");
    }
  }

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-heading text-2xl">饮食营养</h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          { label: "热量", value: totals.calories, unit: "kcal", color: "text-orange-500" },
          { label: "蛋白质", value: totals.protein, unit: "g", color: "text-blue-500" },
          { label: "碳水", value: totals.carbs, unit: "g", color: "text-green-500" },
          { label: "脂肪", value: totals.fat, unit: "g", color: "text-yellow-500" },
        ].map((s, i) => (
          <motion.div key={s.label} variants={item}>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold font-display ${s.color}`}>
                  {loading ? <Skeleton className="h-7 w-12 inline-block" /> : s.value}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{s.unit}</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Food Selector */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索食物..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              {/* Meal tabs */}
              <Tabs value={selectedMeal} onValueChange={setSelectedMeal} className="mt-2">
                <TabsList className="w-full">
                  {MEALS.map((m) => (
                    <TabsTrigger key={m.key} value={m.key} className="flex-1 text-xs">
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {/* Category tabs */}
              <div className="flex gap-1 mt-2 overflow-x-auto">
                {CATEGORIES.map((c) => (
                  <Badge
                    key={c.key}
                    variant={activeCat === c.key ? "default" : "outline"}
                    className="cursor-pointer shrink-0"
                    onClick={() => setActiveCat(c.key)}
                  >
                    {c.label}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1">
                  {filtered.map((food) => (
                    <motion.button
                      key={food.name}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addFood(food)}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{food.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {food.unit} · {food.calories}kcal · P{food.protein}g
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    </motion.button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="col-span-2 text-center text-sm text-muted-foreground py-12">
                      没有找到匹配的食物
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Entries */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                今日记录
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">食物</TableHead>
                      <TableHead className="text-xs w-16">热量</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">
                          <div>{e.name}</div>
                          <div className="text-muted-foreground">{e.meal === "breakfast" ? "早" : e.meal === "lunch" ? "午" : e.meal === "dinner" ? "晚" : "加"}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{e.calories}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => e.id && removeEntry(e.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                          点击左侧食物添加
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
