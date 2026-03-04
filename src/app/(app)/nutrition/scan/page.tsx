"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Barcode, Search, ArrowLeft } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import type { FoodItem, MealType } from "@/types/nutrition";

import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { FoodSearchTab } from "@/components/nutrition/food-search-tab";
import { FoodLogForm } from "@/components/nutrition/food-log-form";
import { CustomFoodDialog } from "@/components/nutrition/custom-food-dialog";
import { RecentFoods } from "@/components/nutrition/recent-foods";

export default function NutritionScanPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawMeal = searchParams.get("meal");
  const quickFoodId = searchParams.get("quick_food_id");
  const validMeals: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  const initialMeal: MealType = validMeals.includes(rawMeal as MealType)
    ? (rawMeal as MealType)
    : "snack";

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("scan");
  const [customCreatorOpenSignal, setCustomCreatorOpenSignal] = useState(0);

  useEffect(() => {
    if (!quickFoodId) return;
    if (selectedFood?.id === quickFoodId) return;

    async function loadQuickFood() {
      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("id", quickFoodId)
        .maybeSingle();

      if (error || !data) return;
      setSelectedFood(data as FoodItem);
    }

    loadQuickFood();
  }, [quickFoodId, selectedFood?.id, supabase]);

  function handleFoodFound(food: FoodItem) {
    setSelectedFood(food);
  }

  function handleLogSuccess() {
    router.push("/nutrition");
  }

  function handleCancelLog() {
    setSelectedFood(null);
  }

  function handleCreateCustomFromBarcodeNotFound() {
    setActiveTab("search");
    setCustomCreatorOpenSignal((prev) => prev + 1);
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/nutrition">
          <Button size="icon" variant="ghost" className="size-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-foreground">Add Food</h1>
      </div>

      {/* Selected food + log form */}
      {selectedFood && (
        <div className="mb-4">
          <FoodLogForm
            food={selectedFood}
            initialMeal={initialMeal}
            onSuccess={handleLogSuccess}
            onCancel={handleCancelLog}
          />
        </div>
      )}

      {/* Quick add from history */}
      {!selectedFood && (
        <div className="mb-4">
          <RecentFoods onFound={handleFoodFound} />
        </div>
      )}

      {/* Tabs: Scan / Search */}
      {!selectedFood && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="scan" className="flex-1 gap-1.5">
              <Barcode className="size-4" />
              Scan Barcode
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1 gap-1.5">
              <Search className="size-4" />
              Search Food
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Point camera at barcode or enter it manually
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BarcodeScanner
                  onFound={handleFoodFound}
                  onCreateCustomRequested={handleCreateCustomFromBarcodeNotFound}
                />
                <CustomFoodDialog onCreated={handleFoodFound} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search">
            <Card className="mb-3">
              <CardContent className="pt-4 space-y-3">
                <FoodSearchTab onFound={handleFoodFound} />
                <CustomFoodDialog
                  onCreated={handleFoodFound}
                  openSignal={customCreatorOpenSignal}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Show tabs again if food is selected to allow changing tab */}
      {selectedFood && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Search for another food</p>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="scan" className="flex-1 gap-1.5">
                <Barcode className="size-4" />
                Scan
              </TabsTrigger>
              <TabsTrigger value="search" className="flex-1 gap-1.5">
                <Search className="size-4" />
                Search
              </TabsTrigger>
            </TabsList>
            <TabsContent value="scan">
              <Card>
                <CardContent className="pt-4">
                  <BarcodeScanner
                    onFound={handleFoodFound}
                    onCreateCustomRequested={handleCreateCustomFromBarcodeNotFound}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="search">
              <Card>
                <CardContent className="pt-4">
                  <FoodSearchTab onFound={handleFoodFound} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
