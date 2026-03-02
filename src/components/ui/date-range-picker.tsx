"use client";

import * as React from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface DateRangePickerProps {
    value?: DateRange;
    onChange?: (date: DateRange | undefined) => void;
    className?: string;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function DateRangePicker({
    value,
    onChange,
    className,
}: DateRangePickerProps) {
    const [isMounted, setIsMounted] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const [mode, setMode] = React.useState<"month" | "year" | "custom">("month");

    // For Month picker state
    const [pickerYear, setPickerYear] = React.useState(() => new Date().getFullYear());

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleCustomRangeSelect = (range: DateRange | undefined) => {
        onChange?.(range);
        // Don't auto close here, let user click Apply or click outside, or close after both selected
    };

    const handleMonthSelect = (monthIndex: number) => {
        const start = startOfMonth(new Date(pickerYear, monthIndex));
        const end = endOfMonth(start);
        onChange?.({ from: start, to: end });
        setIsOpen(false);
    };

    const handleYearSelect = (year: number) => {
        const start = startOfYear(new Date(year, 0));
        const end = endOfYear(start);
        onChange?.({ from: start, to: end });
        setIsOpen(false);
    };

    const triggerLabel = value?.from ? (
        value.to ? (
            <>
                {format(value.from, "LLL dd, y")} -{" "}
                {format(value.to, "LLL dd, y")}
            </>
        ) : (
            format(value.from, "LLL dd, y")
        )
    ) : (
        <span>Pick a date range</span>
    );

    if (!isMounted) {
        return (
            <div className={cn("grid gap-2", className)}>
                <Button
                    id="date"
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-muted-foreground"
                    )}
                    type="button"
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {triggerLabel}
                </Button>
            </div>
        );
    }

    // Generate an array of years, e.g. last 10 years
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !value && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {triggerLabel}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                    <Tabs
                        value={mode}
                        onValueChange={(v) => {
                            if (v === "month" || v === "year" || v === "custom") {
                                setMode(v);
                            }
                        }}
                        className="w-full"
                    >
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="month">Month</TabsTrigger>
                            <TabsTrigger value="year">Year</TabsTrigger>
                            <TabsTrigger value="custom">Custom</TabsTrigger>
                        </TabsList>

                        <TabsContent value="month" className="mt-4">
                            <div className="flex items-center justify-between px-2 pb-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPickerYear((y) => y - 1)}
                                    className="h-7 w-7"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-sm font-medium">{pickerYear}</div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPickerYear((y) => y + 1)}
                                    className="h-7 w-7"
                                    disabled={pickerYear >= currentYear}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {MONTHS.map((m, i) => (
                                    <Button
                                        key={m}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "text-xs",
                                            value?.from &&
                                            value.from.getMonth() === i &&
                                            value.from.getFullYear() === pickerYear &&
                                            "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                                        )}
                                        onClick={() => handleMonthSelect(i)}
                                        disabled={
                                            pickerYear === currentYear && i > currentMonth
                                        }
                                    >
                                        {m.substring(0, 3)}
                                    </Button>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="year" className="mt-4">
                            <ScrollArea className="h-[200px] w-full px-1">
                                <div className="grid grid-cols-2 gap-2">
                                    {years.map((y) => (
                                        <Button
                                            key={y}
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "text-sm",
                                                value?.from &&
                                                value.from.getFullYear() === y &&
                                                value.to &&
                                                value.to.getFullYear() === y &&
                                                "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                                            )}
                                            onClick={() => handleYearSelect(y)}
                                        >
                                            {y}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="custom" className="mt-4">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={value?.from}
                                selected={value}
                                onSelect={handleCustomRangeSelect}
                                numberOfMonths={2}
                            />
                            <div className="mt-3 flex justify-end">
                                <Button size="sm" onClick={() => setIsOpen(false)}>
                                    Apply
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </PopoverContent>
            </Popover>
        </div>
    );
}
