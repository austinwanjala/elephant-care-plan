import { useState } from "react";
import { cn } from "@/lib/utils";

// Simplified teeth representation (Universal Numbering System - 1-32)
// This is a visual representation, not anatomically perfect but functional for UI
const TEETH_UPPER = Array.from({ length: 16 }, (_, i) => i + 1); // 1-16
const TEETH_LOWER = Array.from({ length: 16 }, (_, i) => 32 - i); // 32-17

interface DentalChartProps {
    onToothClick: (toothId: number) => void;
    selectedTeeth: number[];
    toothStatus: Record<number, string>; // e.g., { 1: 'decay', 3: 'filled' }
}

export function DentalChart({ onToothClick, selectedTeeth, toothStatus }: DentalChartProps) {
    return (
        <div className="w-full max-w-3xl mx-auto p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="text-center font-bold mb-4">Adult Dental Chart</h3>

            <div className="flex flex-col gap-8">
                {/* Upper Arch */}
                <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
                    {TEETH_UPPER.map((id) => (
                        <Tooth
                            key={id}
                            id={id}
                            isSelected={selectedTeeth.includes(id)}
                            status={toothStatus[id]}
                            onClick={() => onToothClick(id)}
                        />
                    ))}
                </div>

                {/* Lower Arch */}
                <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
                    {TEETH_LOWER.map((id) => (
                        <Tooth
                            key={id}
                            id={id}
                            isSelected={selectedTeeth.includes(id)}
                            status={toothStatus[id]}
                            onClick={() => onToothClick(id)}
                            isLower
                        />
                    ))}
                </div>
            </div>

            <div className="mt-6 flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-400 rounded-sm"></div>
                    <span>Decay / Issue</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-400 rounded-sm"></div>
                    <span>Treatment Planned</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-400 rounded-sm"></div>
                    <span>Completed</span>
                </div>
            </div>
        </div>
    );
}

interface ToothProps {
    id: number;
    isSelected: boolean;
    status?: string; // 'decay', 'planned', 'completed'
    onClick: () => void;
    isLower?: boolean;
}

function Tooth({ id, isSelected, status, onClick, isLower }: ToothProps) {
    let statusClass = "bg-gray-100 hover:bg-gray-200";
    if (status === 'decay') statusClass = "bg-red-100 border-red-400 text-red-700";
    if (status === 'planned') statusClass = "bg-blue-100 border-blue-400 text-blue-700";
    if (status === 'completed') statusClass = "bg-green-100 border-green-400 text-green-700";

    // Override if selected currently
    if (isSelected) statusClass = "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2";

    return (
        <div
            onClick={onClick}
            className={cn(
                "w-8 h-10 md:w-10 md:h-12 border rounded cursor-pointer transition-all flex flex-col items-center justify-center text-xs font-bold select-none",
                statusClass,
                isLower ? "rounded-b-lg rounded-t-sm" : "rounded-t-lg rounded-b-sm"
            )}
            title={`Tooth #${id}`}
        >
            {id}
        </div>
    );
}
