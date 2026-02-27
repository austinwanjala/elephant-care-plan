import React, { useRef, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from "@/hooks/use-toast";

interface MemberDetails {
  id: string;
  full_name: string;
  member_number: string;
  membership_categories: { name: string } | null;
  insurance_card_token?: string | null;
  is_active: boolean;
  coverage_balance: number;
  benefit_limit: number;
  id_number: string;
  expiry_date?: string;
}

interface InsuranceCardProps {
  member: MemberDetails;
}

export function InsuranceCard({ member }: InsuranceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const qrCodeData = JSON.stringify({
    mid: member.id,
    ts: Date.now(),
    sig: member.insurance_card_token || member.id
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;

    setDownloading(true);
    try {
      const element = cardRef.current;

      // Store original styles to restore later
      const originalTransform = element.style.transform;
      const originalBorderRadius = element.style.borderRadius;

      // Reset transform for accurate capture
      element.style.transform = 'none';
      element.style.borderRadius = '0'; // Square corners for PDF usually look better or keep them if intended

      // Use higher scale for better quality
      const canvas = await html2canvas(element, {
        scale: 4, // Higher scale for crisp text
        useCORS: true,
        logging: false,
        backgroundColor: null, // Transparent background if rounded corners
        allowTaint: true,
      });

      // Restore styles
      element.style.transform = originalTransform;
      element.style.borderRadius = originalBorderRadius;

      const imgData = canvas.toDataURL('image/png');

      // Calculate PDF dimensions (match card aspect ratio)
      // Standard credit card is ~85.6mm x 54mm. 
      // We'll give it a bit more breathing room on paper? No, sticking to standard ID size is professional.
      const pdfWidth = 85.6;
      const pdfHeight = 54;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [pdfWidth + 10, pdfHeight + 10], // Small margin
      });

      // Center the image
      const x = 5;
      const y = 5;

      pdf.addImage(imgData, 'PNG', x, y, pdfWidth, pdfHeight);
      pdf.save(`ElephantDental_Card_${member.member_number}.pdf`);

      toast({
        title: "Card Downloaded",
        description: "Your insurance card has been successfully generated.",
      });

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description: "There was an error generating your card. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8 w-full max-w-2xl mx-auto">
      {/* Card Container - Designed to look like a physical card */}
      <div className="relative perspective-1000 w-full group">
        <div
          ref={cardRef}
          className="relative w-full aspect-[1.586/1] rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-primary/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50"
        >
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

          {/* Card Content */}
          <div className="absolute inset-0 p-8 flex flex-col justify-between z-10 text-white">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center border border-primary/30 shadow-lg">
                  <span className="text-4xl">🐘</span>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-2xl tracking-wide leading-tight">Elephant Dental</h3>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-medium mt-1">Insurance Plan</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Chip Icon Simulation */}
                <div className="w-14 h-10 rounded-lg bg-gradient-to-br from-amber-200 to-amber-500 border border-amber-600/50 opacity-90 relative overflow-hidden shadow-inner hidden sm:block">
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-amber-700/40"></div>
                  <div className="absolute left-1/2 top-0 w-[1px] h-full bg-amber-700/40"></div>
                  <div className="absolute left-1/4 top-1/4 w-1/2 h-1/2 rounded border border-amber-700/40"></div>
                </div>
                <div className="text-right">
                  {member.is_active ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30 px-3 py-1 text-sm">Active</Badge>
                  ) : (
                    <Badge variant="destructive" className="px-3 py-1 text-sm">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Section - Plan Details */}
            <div className="flex justify-between items-end gap-6 mt-4">
              <div className="space-y-5 flex-1 min-w-0">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Membership Plan</p>
                  <p className="text-xl sm:text-2xl font-semibold text-accent tracking-wide truncate">
                    {member.membership_categories?.name || 'Standard Plan'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Coverage Limit</p>
                    <p className="text-base font-mono text-slate-200 truncate">{formatCurrency(member.benefit_limit || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Balance</p>
                    <p className="text-base font-mono text-slate-200 truncate">{formatCurrency(member.coverage_balance || 0)}</p>
                  </div>
                  {member.id_number && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">National ID</p>
                      <p className="text-base font-mono text-slate-200 truncate">{member.id_number}</p>
                    </div>
                  )}
                  {member.expiry_date && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Valid Thru</p>
                      <p className="text-base font-mono text-slate-200 truncate">{new Date(member.expiry_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="hidden sm:block w-28 h-28 bg-white rounded-xl p-2 shadow-xl shrink-0">
                <QRCodeSVG
                  value={qrCodeData || ''}
                  size={120}
                  style={{ height: "100%", width: "100%" }}
                  level="M"
                />
              </div>
            </div>

            {/* Footer - Member Details */}
            <div className="pt-5 border-t border-slate-700/30 mt-4">
              <div className="flex justify-between items-end">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Member Name</p>
                  <h2 className="text-2xl sm:text-3xl font-medium tracking-wide font-sans truncate text-shadow-sm">{member.full_name}</h2>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Member No</p>
                  <p className="text-xl font-mono text-slate-200 tracking-wider shadow-black drop-shadow-sm font-semibold">{member.member_number}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex gap-3">
        <Button
          className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/20 h-14 text-lg font-semibold rounded-xl"
          size="lg"
          onClick={handleDownloadCard}
          disabled={downloading || !member.is_active}
        >
          {downloading ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Generating Card...
            </>
          ) : (
            <>
              <Download className="mr-3 h-6 w-6" /> Download Official Card
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground/80 text-center max-w-sm">
        This digital card acts as valid proof of insurance coverage at all Elephant Dental branches.
      </p>
    </div>
  );
}
