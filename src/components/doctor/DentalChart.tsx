import { cn } from "@/lib/utils";

// FDI Adult Numbering - Upper Jaw (Right to Left then Left to Right)
const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
// FDI Adult Numbering - Lower Jaw (Right to Left then Left to Right)
const ADULT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// FDI Child Numbering
const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

interface DentalChartProps {
    onToothClick: (toothId: number) => void;
    selectedTeeth: number[];
    toothStatus: Record<number, string>;
    isChild?: boolean;
}

export function DentalChart({ onToothClick, selectedTeeth, toothStatus, isChild = false }: DentalChartProps) {
    const upperJaw = isChild ? CHILD_UPPER : ADULT_UPPER;
    const lowerJaw = isChild ? CHILD_LOWER : ADULT_LOWER;

    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 border rounded-2xl bg-slate-50/30 shadow-sm">
            <h3 className="text-center font-serif font-bold text-xl mb-8 text-slate-800">
                {isChild ? "Pediatric Dental Map" : "Anatomical Dental Map"}
            </h3>

            <div className="space-y-12 bg-white p-6 sm:p-10 rounded-xl border shadow-inner overflow-x-auto">
                {/* Upper Jaw */}
                <div className="space-y-4 min-w-[600px]">
                    <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Right</span>
                        <span className="text-primary/60">Upper Jaw</span>
                        <span>Left</span>
                    </div>
                    <div className="flex justify-center gap-1 sm:gap-2">
                        {upperJaw.map((id) => {
                            const lastDigit = id % 10;
                            let imgSrc = "/img/incisor.png";
                            if (lastDigit === 3) imgSrc = "/img/canine.png";
                            else if (lastDigit >= 4 && lastDigit <= 5) imgSrc = "/img/premolar.jpg";
                            else if (lastDigit >= 6) imgSrc = "/img/molar.png";

                            return (
                                <Tooth
                                    key={id}
                                    id={id}
                                    isSelected={selectedTeeth.includes(id)}
                                    status={toothStatus[id]}
                                    onClick={() => onToothClick(id)}
                                    imageSrc={imgSrc}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Lower Jaw */}
                <div className="space-y-4 min-w-[600px]">
                    <div className="flex justify-center gap-1 sm:gap-2">
                        {lowerJaw.map((id) => {
                            const lastDigit = id % 10;
                            let imgSrc = "/img/incisor.png";
                            if (lastDigit === 3) imgSrc = "/img/canine.png";
                            else if (lastDigit >= 4 && lastDigit <= 5) imgSrc = "/img/premolar.jpg";
                            else if (lastDigit >= 6) imgSrc = "/img/molar.png";

                            return (
                                <Tooth
                                    key={id}
                                    id={id}
                                    isSelected={selectedTeeth.includes(id)}
                                    status={toothStatus[id]}
                                    onClick={() => onToothClick(id)}
                                    isLower
                                    imageSrc={imgSrc}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Right</span>
                        <span className="text-primary/60">Lower Jaw</span>
                        <span>Left</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t flex flex-wrap justify-center gap-6 text-xs font-semibold">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="text-red-700">Decay</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <span className="text-cyan-700">Planned</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span className="text-blue-700">Completed</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-orange-700">Selected</span>
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
    imageSrc?: string;
}

function Tooth({ id, isSelected, status, onClick, isLower, imageSrc }: ToothProps) {
    const lastDigit = id % 10;
    let toothPath = "";

    // Anatomical SVG paths (fallback/others)
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
    if (status === 'decay') colorClass = "fill-red-100 stroke-red-500";
    if (status === 'planned') colorClass = "fill-cyan-100 stroke-cyan-500";
    if (status === 'completed') colorClass = "fill-blue-100 stroke-blue-500";
    if (isSelected) colorClass = "fill-orange-100 stroke-orange-500";

    // For images, we might want different overlay/border styles when selected
    const imageContainerClass = cn(
        "relative w-7 h-8 flex items-center justify-center transition-all duration-200",
        isSelected ? "scale-110 z-10 drop-shadow-md" : "hover:-translate-y-1"
    );

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col items-center cursor-pointer transition-all duration-200",
                !imageSrc && (isSelected ? "scale-110 z-10" : "hover:-translate-y-1")
            )}
        >
            {!isLower && <span className={cn("text-[8px] font-bold mb-1", isSelected ? "text-orange-600" : "text-slate-400")}>{id}</span>}

            {imageSrc ? (
                <div className={imageContainerClass}>
                    <img
                        src={imageSrc}
                        alt={`Tooth ${id}`}
                        className={cn(
                            "w-full h-full object-contain filter",
                            // Apply filters based on status? Or just borders?
                            // For now, let's use borders/overlays for status on images
                            status === 'decay' && "drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]",
                            status === 'planned' && "drop-shadow-[0_0_2px_rgba(6,182,212,0.8)]",
                            status === 'completed' && "drop-shadow-[0_0_2px_rgba(59,130,246,0.8)]",
                            isSelected && "drop-shadow-[0_0_4px_rgba(249,115,22,0.9)]"
                        )}
                    />
                    {/* Status Overlays for images if needed */}
                    {status && (
                        <div className={cn(
                            "absolute inset-0 opacity-20 rounded-sm",
                            status === 'decay' && "bg-red-500",
                            status === 'planned' && "bg-cyan-500",
                            status === 'completed' && "bg-blue-500",
                        )} />
                    )}
                </div>
            ) : (
                <svg width="28" height="32" viewBox="0 0 20 24" className={cn("transition-all drop-shadow-sm", colorClass)}>
                    <path d={toothPath} strokeWidth="1.5" />
                </svg>
            )}

            {isLower && <span className={cn("text-[8px] font-bold mt-1", isSelected ? "text-orange-600" : "text-slate-400")}>{id}</span>}
        </div>
    );
}