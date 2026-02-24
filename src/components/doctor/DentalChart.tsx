import { cn } from "@/lib/utils";

// FDI Adult Numbering - Upper Jaw (Right to Left then Left to Right)
const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
// FDI Adult Numbering - Lower Jaw (Right to Left then Left to Right)
const ADULT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// FDI Child Numbering
const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

// FDI Mixed Dentition (Early Mixed Stage: Primary + Permanent 1st Molars)
const MIXED_UPPER = [16, 55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 26];
const MIXED_LOWER = [46, 85, 84, 83, 82, 81, 71, 72, 73, 74, 75, 36];

export type DentalChartMode = 'adult' | 'child' | 'mixed';

interface DentalChartProps {
    onToothClick: (toothId: number) => void;
    selectedTeeth: number[];
    toothStatus: Record<number, string>;
    toothStages?: Record<number, { current: number, total: number }>;
    isChild?: boolean; // Deprecated in favor of mode, kept for backward compatibility
    mode?: DentalChartMode;
    readOnly?: boolean;
    disabledTeeth?: number[];
}

export function DentalChart({
    onToothClick,
    selectedTeeth,
    toothStatus,
    toothStages = {},
    isChild = false,
    mode,
    readOnly,
    disabledTeeth = []
}: DentalChartProps) {
    // Determine effective mode
    const effectiveMode: DentalChartMode = mode || (isChild ? 'child' : 'adult');

    let upperJaw = ADULT_UPPER;
    let lowerJaw = ADULT_LOWER;
    let title = "Anatomical Dental Map";

    switch (effectiveMode) {
        case 'child':
            upperJaw = CHILD_UPPER;
            lowerJaw = CHILD_LOWER;
            title = "Pediatric Dental Map";
            break;
        case 'mixed':
            upperJaw = MIXED_UPPER;
            lowerJaw = MIXED_LOWER;
            title = "Pediatric / Mixed Dentition Dental Map";
            break;
        case 'adult':
        default:
            upperJaw = ADULT_UPPER;
            lowerJaw = ADULT_LOWER;
            title = "Anatomical Dental Map";
            break;
    }

    const getToothImage = (id: number) => {
        const lastDigit = id % 10;
        if (lastDigit === 3) return "/img/canine.png";
        else if (lastDigit >= 4 && lastDigit <= 5) return "/img/premolar.jpg";
        else if (lastDigit >= 6) return "/img/molar.png";
        return "/img/incisor.png";
    };

    // Calculate vertical offset for curve effect
    const getCurveOffset = (id: number, isUpper: boolean) => {
        const lastDigit = id % 10;
        // Central Incisors (1) -> Lowest point (0px)
        // Molars (8) -> Highest point (e.g., 40px)

        let offset = 0;
        if (lastDigit === 1) offset = 0;
        else if (lastDigit === 2) offset = 5;
        else if (lastDigit === 3) offset = 15; // Canine - start curving up
        else if (lastDigit === 4) offset = 30;
        else if (lastDigit === 5) offset = 40;
        else if (lastDigit >= 6) offset = 50;

        // For lower jaw, we might want to curve downwards or same direction depending on visual preference.
        // Usually, a "smile" curve means corners are higher.
        // So for "Upper Jaw", incisors are lowest, molars highest.
        // For "Lower Jaw", incisors are highest, molars lowest? Or usually displayed as an arch too.
        // Let's standard "Arch" display:
        // Upper: Concave down (Incisors low, Molars high visually on screen? No, standard chart is usually straight or slightly curved).
        // Request says "curvature of a mouth".
        // Let's try: Upper Jaw -> Incisors (bottom), Molars (top). Arch shape.
        // Lower Jaw -> Incisors (top), Molars (bottom). U shape.

        if (isUpper) {
            // Arch like ◠ . Incisors (1) at bottom (high Y value?), Molars (8) at top (low Y value?)
            // If Flex container aligns items at 'start' (top), then increasing Y moves them down.
            // visual: 
            //   M M       M M
            //    C         C
            //     I I I I

            // So Motars should have 0 offset? Incisors should have max offset?
            // Let's try:
            // Molars: 0px
            // Premolars: 20px
            // Canines: 40px
            // Incisors: 50px

            if (lastDigit >= 6) offset = 0;
            else if (lastDigit === 5) offset = 15;
            else if (lastDigit === 4) offset = 25;
            else if (lastDigit === 3) offset = 35;
            else if (lastDigit === 2) offset = 45;
            else if (lastDigit === 1) offset = 50;
        } else {
            // Lower Jaw (U shape). 
            //   I I I I
            //  C       C
            // M M     M M

            // Incisors at top (0px or negative?). Molars at bottom (max positive).
            // If we use mt (margin-top) or translate-y:
            // Incisors: 0px
            // Molars: 50px

            if (lastDigit === 1) offset = 0;
            else if (lastDigit === 2) offset = 5;
            else if (lastDigit === 3) offset = 15;
            else if (lastDigit === 4) offset = 30;
            else if (lastDigit === 5) offset = 40;
            else if (lastDigit >= 6) offset = 50;
        }

        return offset;
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 border rounded-2xl bg-slate-50/30 shadow-sm">
            <h3 className="text-center font-serif font-bold text-xl mb-8 text-slate-800">
                {title}
            </h3>

            <div className="bg-white/50 p-4 sm:p-8 rounded-xl border shadow-inner overflow-x-auto relative">
                {/* Background decorative elements to suggest jaw arch */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-200/50 w-full" />

                {effectiveMode === 'mixed' ? (
                    <div className="flex flex-col items-center gap-8 sm:gap-12 relative w-fit mx-auto">
                        {/* Upper Jaw Group */}
                        <div className="relative p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-b from-orange-50/80 to-red-50/20 border border-orange-100 shadow-sm">
                            <h4 className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-0.5 text-[10px] font-bold text-orange-400 uppercase tracking-widest border border-orange-100 rounded-full shadow-sm">Upper Jaw</h4>

                            <div className="flex flex-col items-center gap-2">
                                {/* Upper Permanent (Outer) */}
                                <div className="flex justify-center gap-0.5 pb-2 border-b border-dashed border-orange-200/50 w-full">
                                    {[17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27].map(id => (
                                        <Tooth
                                            key={id}
                                            id={id}
                                            isSelected={selectedTeeth.includes(id)}
                                            status={toothStatus[id]}
                                            stage={toothStages[id]}
                                            onClick={() => onToothClick(id)}
                                            imageSrc={getToothImage(id)}
                                            disabled={disabledTeeth.includes(id)}
                                        />
                                    ))}
                                </div>

                                {/* Upper Primary (Inner) */}
                                <div className="flex justify-center gap-0.5 bg-yellow-50/50 px-4 py-2 rounded-full border border-yellow-100/50">
                                    {[55, 54, 53, 52, 51, 61, 62, 63, 64, 65].map(id => (
                                        <Tooth
                                            key={id}
                                            id={id}
                                            isSelected={selectedTeeth.includes(id)}
                                            status={toothStatus[id]}
                                            stage={toothStages[id]}
                                            onClick={() => onToothClick(id)}
                                            imageSrc={getToothImage(id)}
                                            small
                                            disabled={disabledTeeth.includes(id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Lower Jaw Group */}
                        <div className="relative p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-t from-orange-50/80 to-red-50/20 border border-orange-100 shadow-sm">
                            <h4 className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-3 py-0.5 text-[10px] font-bold text-orange-400 uppercase tracking-widest border border-orange-100 rounded-full shadow-sm">Lower Jaw</h4>

                            <div className="flex flex-col items-center gap-2">
                                {/* Lower Primary (Inner) */}
                                <div className="flex justify-center gap-0.5 bg-yellow-50/50 px-4 py-2 rounded-full border border-yellow-100/50">
                                    {[85, 84, 83, 82, 81, 71, 72, 73, 74, 75].map(id => (
                                        <Tooth
                                            key={id}
                                            id={id}
                                            isSelected={selectedTeeth.includes(id)}
                                            status={toothStatus[id]}
                                            stage={toothStages[id]}
                                            onClick={() => onToothClick(id)}
                                            isLower
                                            imageSrc={getToothImage(id)}
                                            small
                                            disabled={disabledTeeth.includes(id)}
                                        />
                                    ))}
                                </div>

                                {/* Lower Permanent (Outer) */}
                                <div className="flex justify-center gap-0.5 pt-2 border-t border-dashed border-orange-200/50 w-full">
                                    {[47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37].map(id => (
                                        <Tooth
                                            key={id}
                                            id={id}
                                            isSelected={selectedTeeth.includes(id)}
                                            status={toothStatus[id]}
                                            stage={toothStages[id]}
                                            onClick={() => onToothClick(id)}
                                            isLower
                                            imageSrc={getToothImage(id)}
                                            disabled={disabledTeeth.includes(id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 py-4 w-fit mx-auto">
                        <div className="space-y-2">
                            <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Right</span>
                                <span className="text-primary/60">Upper Jaw</span>
                                <span>Left</span>
                            </div>
                            <div className="flex justify-center gap-0.5 sm:gap-2 bg-white/50 p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm">
                                {upperJaw.map((id) => (
                                    <Tooth
                                        key={id}
                                        id={id}
                                        isSelected={selectedTeeth.includes(id)}
                                        status={toothStatus[id]}
                                        stage={toothStages[id]}
                                        onClick={() => onToothClick(id)}
                                        imageSrc={getToothImage(id)}
                                        disabled={disabledTeeth.includes(id)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-center gap-0.5 sm:gap-2 bg-white/50 p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm">
                                {lowerJaw.map((id) => (
                                    <Tooth
                                        key={id}
                                        id={id}
                                        isSelected={selectedTeeth.includes(id)}
                                        status={toothStatus[id]}
                                        stage={toothStages[id]}
                                        onClick={() => onToothClick(id)}
                                        isLower
                                        imageSrc={getToothImage(id)}
                                        disabled={disabledTeeth.includes(id)}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Right</span>
                                <span className="text-primary/60">Lower Jaw</span>
                                <span>Left</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>


        </div >
    );
}

interface ToothProps {
    id: number;
    isSelected: boolean;
    status?: string;
    stage?: { current: number, total: number };
    onClick: () => void;
    isLower?: boolean;
    imageSrc?: string;
    small?: boolean;
    disabled?: boolean;
}

function Tooth({ id, isSelected, status, stage, onClick, isLower, imageSrc, small, disabled }: ToothProps) {
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
    if (status === 'decay') colorClass = "fill-red-500 stroke-red-700";
    if (status === 'missing') colorClass = "fill-yellow-400 stroke-yellow-600 opacity-80";
    if (status === 'filled') colorClass = "fill-green-500 stroke-green-700";
    if (status === 'crowned') colorClass = "fill-blue-500 stroke-blue-700";
    if (status === 'partial_denture') colorClass = "fill-pink-500 stroke-pink-700";

    // Legacy support or Treatment statuses
    if (status === 'planned') colorClass = "fill-cyan-400 stroke-cyan-600";
    if (status === 'in_progress') colorClass = "fill-amber-400 stroke-amber-600 animate-pulse";
    if (status === 'completed') colorClass = "fill-blue-500 stroke-blue-700";
    if (status === 'multi_stage_completed') colorClass = "fill-orange-500 stroke-orange-700";

    if (isSelected) colorClass = "fill-cyan-400 stroke-cyan-600 stroke-2";

    // Anatomical Sizing based on tooth type
    let sizeClass = small ? "w-5 h-6" : "w-7 h-8";
    let svgWidth = "28";
    let svgHeight = "32";

    if (!small) {
        if (lastDigit >= 6) { // Molars
            sizeClass = "w-10 h-10";
            svgWidth = "38";
            svgHeight = "40";
        } else if (lastDigit >= 4) { // Premolars
            sizeClass = "w-8 h-9";
            svgWidth = "32";
            svgHeight = "36";
        } else if (lastDigit === 3) { // Canines
            sizeClass = "w-7 h-9";
            svgWidth = "28";
            svgHeight = "36";
        } else { // Incisors
            sizeClass = "w-7 h-8";
            svgWidth = "28";
            svgHeight = "32";
        }
    }

    // For images, we might want different overlay/border styles when selected
    const imageContainerClass = cn(
        "relative flex items-center justify-center transition-all duration-200",
        sizeClass,
        isSelected ? "scale-110 z-10 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "hover:-translate-y-1"
    );

    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={cn(
                "group relative flex flex-col items-center transition-all duration-200 shrink-0",
                disabled ? "cursor-not-allowed opacity-50 grayscale" : "cursor-pointer",
                !imageSrc && !disabled && (isSelected ? "scale-125 z-10" : "hover:-translate-y-1")
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
                            // Invert upper jaw images (Crown Down) if not lower
                            !isLower && "rotate-180",
                            status === 'decay' && "drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]",
                            status === 'filled' && "drop-shadow-[0_0_2px_rgba(34,197,94,0.8)]",
                            status === 'crowned' && "drop-shadow-[0_0_2px_rgba(59,130,246,0.8)]",
                            status === 'missing' && "opacity-20 grayscale", // Stronger missing state
                            status === 'partial_denture' && "drop-shadow-[0_0_2px_rgba(236,72,153,0.8)]",
                            status === 'in_progress' && "drop-shadow-[0_0_2px_rgba(245,158,11,0.8)]",
                            isSelected && "drop-shadow-[0_0_6px_rgba(249,115,22,1)]"
                        )}
                    />
                    {/* Status Overlays for images if needed */}
                    {status && (
                        <div className={cn(
                            "absolute inset-0 opacity-60 rounded-full mix-blend-multiply",
                            status === 'decay' && "bg-red-500",
                            status === 'filled' && "bg-green-600",
                            status === 'crowned' && "bg-blue-600",
                            status === 'missing' && "bg-yellow-400",
                            status === 'partial_denture' && "bg-pink-600",
                            status === 'in_progress' && "bg-amber-500",
                            status === 'multi_stage_completed' && "bg-orange-500",
                        )} />
                    )}
                    {/* Stage Indicator Overlay */}
                    {stage && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-blue-600 text-white text-[9px] font-black px-1 rounded-full shadow-lg border border-white">
                                {stage.current}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <svg width={svgWidth} height={svgHeight} viewBox="0 0 20 24" className={cn("transition-all drop-shadow-sm", colorClass)}>
                        <path d={toothPath} strokeWidth="1.5" />
                    </svg>
                    {stage && (
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
                            <div className="bg-blue-600 text-white text-[9px] font-black px-1 rounded-full shadow-lg border border-white">
                                {stage.current}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isLower && <span className={cn("text-[8px] font-bold mt-1", isSelected ? "text-orange-600" : "text-slate-400")}>{id}</span>}
        </div>
    );
}