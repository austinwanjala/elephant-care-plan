import { useState } from "react";
import { cn } from "@/lib/utils";

// Simplified teeth representation (Universal Numbering System - 1-32)
// This is a visual representation, not anatomically perfect but functional for UI
// FDI World Dental Federation notation
const TEETH_Q1 = [18, 17, 16, 15, 14, 13, 12, 11]; // Upper Right
const TEETH_Q2 = [21, 22, 23, 24, 25, 26, 27, 28]; // Upper Left
const TEETH_Q3 = [48, 47, 46, 45, 44, 43, 42, 41]; // Lower Right (Note: Q3 is conventionally Lower Left in FDI, but for visual symmetry in chart: Q1 | Q2 \n Q4 | Q3. Wait.
// Standard View: Patient's Right is Viewer's Left.
// Q1 (Upper Right) - Viewer Left
// Q2 (Upper Left) - Viewer Right
// Q3 (Lower Left) - Viewer Right
// Q4 (Lower Right) - Viewer Left
// So layout:
// Q1  Q2
// Q4  Q3

// Correct layout for UI (Viewer looking at patient):
// Upper Right (18-11) | Upper Left (21-28)
// ----------------------------------------
// Lower Right (48-41) | Lower Left (31-38)

const TEETH_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const TEETH_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const TEETH_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

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
                <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
                    {/* Q1 Upper Right */}
                    <div className="flex gap-1 justify-end">
                        {TEETH_UPPER_RIGHT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                    </div>
                    {/* Q2 Upper Left */}
                    <div className="flex gap-1 justify-start">
                        {TEETH_UPPER_LEFT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                    </div>
                </div>

                {/* Lower Arch */}
                <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
                    {/* Q4 Lower Right */}
                    <div className="flex gap-1 justify-end">
                        {TEETH_LOWER_RIGHT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>
                    {/* Q3 Lower Left */}
                    <div className="flex gap-1 justify-start">
                        {TEETH_LOWER_LEFT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>
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
