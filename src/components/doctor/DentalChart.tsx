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

            <div className="relative">
                {/* Cross/Divider lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-px bg-slate-200"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-full w-px bg-slate-200"></div>
                </div>

                <div className="grid grid-cols-2 gap-8 md:gap-12 py-6 relative">
                    {/* Quadrant 1 (Upper Right) - 18-11 */}
                    <div className="flex justify-end items-end gap-1 flex-wrap-reverse max-w-[200px] ml-auto">
                        {TEETH_UPPER_RIGHT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                        <span className="text-xs font-bold text-muted-foreground w-full text-right pr-2">Q1</span>
                    </div>

                    {/* Quadrant 2 (Upper Left) - 21-28 */}
                    <div className="flex justify-start items-end gap-1 flex-wrap max-w-[200px] mr-auto">
                        {TEETH_UPPER_LEFT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                        <span className="text-xs font-bold text-muted-foreground w-full text-left pl-2">Q2</span>
                    </div>

                    {/* Quadrant 4 (Lower Right) - 48-41 */}
                    <div className="flex justify-end items-start gap-1 flex-wrap-reverse max-w-[200px] ml-auto">
                        <span className="text-xs font-bold text-muted-foreground w-full text-right pr-2">Q4</span>
                        {TEETH_LOWER_RIGHT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>

                    {/* Quadrant 3 (Lower Left) - 31-38 */}
                    <div className="flex justify-start items-start gap-1 flex-wrap max-w-[200px] mr-auto">
                        <span className="text-xs font-bold text-muted-foreground w-full text-left pl-2">Q3</span>
                        {TEETH_LOWER_LEFT.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t flex flex-wrap justify-center gap-6 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-100 border border-red-400 rounded-sm"></div>
                    <span>Decay</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-100 border border-blue-400 rounded-sm"></div>
                    <span>Planned</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-400 rounded-sm"></div>
                    <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary text-primary-foreground flex items-center justify-center rounded-sm text-[8px]">✓</div>
                    <span>Selected</span>
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
    let statusClass = "bg-white border-slate-200 hover:border-slate-400 text-slate-600";
    if (status === 'decay') statusClass = "bg-red-50 border-red-400 text-red-700";
    if (status === 'planned') statusClass = "bg-blue-50 border-blue-400 text-blue-700";
    if (status === 'completed') statusClass = "bg-green-50 border-green-400 text-green-700";

    // Override if selected currently
    if (isSelected) statusClass = "bg-primary text-primary-foreground border-primary shadow-md scale-110 z-10";

    return (
        <div
            onClick={onClick}
            className={cn(
                "w-8 h-10 md:w-9 md:h-11 border-2 text-xs font-bold select-none cursor-pointer transition-all duration-200 flex flex-col items-center justify-center relative",
                statusClass,
                isLower ? "rounded-b-xl rounded-t-sm" : "rounded-t-xl rounded-b-sm",
                !isSelected && "hover:-translate-y-0.5"
            )}
            title={`Tooth #${id}`}
        >
            <span className={cn("absolute opacity-40 text-[10px]", isLower ? "bottom-1" : "top-1")}>{id}</span>
        </div>
    );
}
