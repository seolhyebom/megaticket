
"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Zap, Brain } from "lucide-react";
import { getModelOptions } from "@/lib/model-config";

interface ModelSelectorProps {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
}

export function ModelSelector({ value, onValueChange, disabled }: ModelSelectorProps) {
    const models = getModelOptions();

    return (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger className="w-[200px] h-9 bg-white/80 border-orange-200 text-xs backdrop-blur-sm focus:ring-orange-500/20 text-gray-700 shadow-sm hover:border-orange-400 hover:ring-2 hover:ring-orange-100 transition-all duration-300">
                <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
                {models.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                        <div className="flex items-center gap-2">
                            {model.value.includes('nova') ? (
                                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                            ) : (
                                <Brain className="h-3.5 w-3.5 text-purple-500" />
                            )}
                            <span>{model.label}</span>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
