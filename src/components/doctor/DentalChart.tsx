import { cn } from "@/lib/utils";

// FDI Adult Numbering
const ADULT_Q1 = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_Q2 = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_Q3 = [31, 32, 33, 34, 35, 36, 37, 38];
const ADULT_Q4 = [48, 47, 46, 45, 44, 43, 42, 41];

// FDI Child Numbering (Deciduous)
const CHILD_Q5 = [55, 54, 53, 52, 51];
const CHILD_Q6 = [61, 62, 63, 64, 65];
const CHILD_Q7 = [71, 72, 73, 74, 75];
const CHILD_Q8 = [85, 84, 83, 82, 81];

interface DentalChartProps {
    onToothClick: (toothId: number) => void;
    selectedTeeth: number[];
    toothStatus: Record<number, string>;
    isChild?: boolean;
}

export function DentalChart({ onToothClick, selectedTeeth, toothStatus, isChild = false }: DentalChartProps) {
    const quadrants = isChild 
        ? { q1: CHILD_Q5, q2: CHILD_Q6, q3: CHILD_Q7, q4: CHILD_Q8, labels: ['Q5', 'Q6', 'Q7', 'Q8'] }
        : { q1: ADULT_Q1, q2: ADULT_Q2, q3: ADULT_Q3, q4: ADULT_Q4, labels: ['Q1', 'Q2', 'Q3', 'Q4'] };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 border rounded-xl bg-slate-50/50 shadow-inner">
            <h3 className="text-center font-serif font-bold text-lg mb-6 text-slate-800">
                {isChild ? "Pediatric Dental Chart (20 Teeth)" : "Adult Dental Chart (32 Teeth)"}
            </h3>

            <div className="relative bg-white p-8 rounded-lg border shadow-sm">
                {/* Cross/Divider lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[90%] h-px bg-slate-200"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-[90%] w-px bg-slate-200"></div>
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-16 relative">
                    {/* Upper Right (Q1/Q5) */}
                    <div className="flex justify-end items-end gap-1 flex-wrap-reverse max-w-[240px] ml-auto">
                        {quadrants.q1.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                        <span className="text-[10px] font-bold text-slate-400 w-full text-right pr-2">{quadrants.labels[0]}</span>
                    </div>

                    {/* Upper Left (Q2/Q6) */}
                    <div className="flex justify-start items-end gap-1 flex-wrap max-w-[240px] mr-auto">
                        {quadrants.q2.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} />
                        ))}
                        <span className="text-[10px] font-bold text-slate-400 w-full text-left pl-2">{quadrants.labels[1]}</span>
                    </div>

                    {/* Lower Right (Q4/Q8) */}
                    <div className="flex justify-end items-start gap-1 flex-wrap-reverse max-w-[240px] ml-auto">
                        <span className="text-[10px] font-bold text-slate-400 w-full text-right pr-2">{quadrants.labels[3]}</span>
                        {quadrants.q4.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>

                    {/* Lower Left (Q3/Q7) */}
                    <div className="flex justify-start items-start gap-1 flex-wrap max-w-[240px] mr-auto">
                        <span className="text-[10px] font-bold text-slate-400 w-full text-left pl-2">{quadrants.labels[2]}</span>
                        {quadrants.q3.map((id) => (
                            <Tooth key={id} id={id} isSelected={selectedTeeth.includes(id)} status={toothStatus[id]} onClick={() => onToothClick(id)} isLower />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t flex flex-wrap justify-center gap-6 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded-sm"></div>
                    <span className="text-slate-600">Decay</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded-sm"></div>
                    <span className="text-slate-600">Planned</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded-sm"></div>
                    <span className="text-slate-600">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary text-primary-foreground flex items-center justify-center rounded-sm text-[8px]">✓</div>
                    <span className="text-slate-600">Selected</span>
                </div>
            </div>
        </div>
    );
}

interface ToothProps {
    id: number;
    isSelected: boolean;
    status?: string;
    onClick: () => void;
    isLower?: boolean;
}

function Tooth({ id, isSelected, status, onClick, isLower }: ToothProps) {
    // Determine tooth type based on FDI number for realistic shape
    const lastDigit = id % 10;
    let toothPath = "";
    
    // Simplified realistic SVG paths for different tooth types
    if (lastDigit <= 2) { // Incisors
        toothPath = isLower 
            ? "M4,2 C4,2 2,10 2,15 C2,20 5,22 10,22 C15,22 18,20 18,15 C18,10 16,2 16,2 L4,2" 
            : "M2,20 C2,20 4,12 4,7 C4,2 7,0 10,0 C13,0 16,2 16,7 C16,12 18,20 18,20 L2,20";
    } else if (lastDigit === 3) { // Canines
        toothPath = isLower
            ? "M5,2 L10,0 L15,2 C15,2 18,10 18,15 C18,20 15,22 10,22 C5,22 2,20 2,15 C2,10 5,2 5,2"
            : "M2,20 C2,20 5,12 5,7 L10,0 L15,7 C15,12 18,20 18,20 L2,20";
    } else if (lastDigit <= 5) { // Premolars
        toothPath = isLower
            ? "M3,5 C3,5 2,10 2,15 C2,20 5,22 10,22 C15,22 18,20 18,15 C18,10 17,5 17,5 L3,5"
            : "M2,17 C2,17 3,12 3,7 C3,2 6,0 10,0 C14,0 17,2 17,7 C17,12 18,17 18,17 L2,17";
    } else { // Molars
        toothPath = isLower
            ? "M2,5 C2,5 1,10 1,15 C1,20 4,23 10,23 C16,23 19,20 19,15 C19,10 18,5 18,5 L2,5"
            : "M1,18 C1,18 2,13 2,8 C2,3 5,0 10,0 C15,0 18,3 18,8 C18,13 19,18 19,18 L1,18";
    }

    let colorClass = "fill-white stroke-slate-300 hover:stroke-slate-500";
    if (status === 'decay') colorClass = "fill-red-50 stroke-red-400";
    if (status === 'planned') colorClass = "fill-blue-50 stroke-blue-400";
    if (status === 'completed') colorClass = "fill-green-50 stroke-green-400";
    if (isSelected) colorClass = "fill-primary stroke-primary-foreground";

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col items-center cursor-pointer transition-all duration-200",
                isSelected ? "scale-110 z-10" : "hover:-translate-y-1"
            )}
            title={`Tooth #${id}`}
        >
            <span className={cn(
                "text-[9px] font-bold mb-1 transition-colors",
                isSelected ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
            )}>
                {id}
            </span>
            <svg width="24" height="28" viewBox="0 0 20 24" className={cn("transition-all", colorClass)}>
                <path d={toothPath} strokeWidth="1.5" />
                {isSelected && (
                    <circle cx="10" cy="12" r="3" className="fill-white animate-pulse" />
                )}
            </svg>
        </div>
    );
}