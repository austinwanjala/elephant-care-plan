import React, { useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { User, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface MemberDetails {
  full_name: string;
  member_number: string;
  membership_categories: { name: string } | null;
  qr_code_data: string | null;
  is_active: boolean;
  coverage_balance: number;
  benefit_limit: number;
  id_number: string; // Added ID number
}

interface InsuranceCardProps {
  member: MemberDetails;
}

export function InsuranceCard({ member }: InsuranceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const coveragePercentage = member.benefit_limit
    ? (member.coverage_balance / member.benefit_limit) * 100
    : 0;

  const handleDownloadCard = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true }); // Scale for better resolution, useCORS for images
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height], // Use canvas dimensions for PDF
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`ElephantDental_InsuranceCard_${member.member_number}.pdf`);
    }
  };

  return (
    <Card className="relative w-full max-w-sm mx-auto overflow-hidden rounded-xl shadow-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <div ref={cardRef} className="p-6 space-y-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary-foreground/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <span className="text-xl">🐘</span>
            </div>
            <span className="text-lg font-serif font-bold">Elephant Dental</span>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
            Insurance Card
          </Badge>
        </div>

        {/* Member Info & QR Code */}
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-primary-foreground/70" />
          </div>
          <h3 className="font-serif font-bold text-2xl mb-1">
            {member.full_name}
          </h3>
          <p className="text-primary-foreground/80 font-mono text-sm mb-1">
            Member ID: {member.member_number}
          </p>
          <p className="text-primary-foreground/80 font-mono text-sm mb-4">
            National ID: {member.id_number}
          </p>
          {member.membership_categories && (
            <Badge className="bg-accent text-accent-foreground mb-4">
              {member.membership_categories.name}
            </Badge>
          )}

          {member.qr_code_data ? (
            <div className="bg-white rounded-lg p-3 inline-block shadow-md">
              <QRCodeSVG
                value={member.qr_code_data}
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>
          ) : (
            <div className="bg-primary-foreground/10 rounded-lg p-4 inline-block text-primary-foreground/70">
              <User className="h-20 w-20" />
              <p className="text-xs mt-2">QR Code not active</p>
            </div>
          )}
          <p className="text-xs text-primary-foreground/70 mt-4">
            Scan at any branch for instant service
          </p>
        </div>

        {/* Coverage Status */}
        {member.is_active && (
          <div className="pt-4 border-t border-primary-foreground/30">
            <div className="flex items-center justify-between text-sm text-primary-foreground/80 mb-1">
              <span>Coverage Balance:</span>
              <span className="font-semibold">
                KES {member.coverage_balance.toLocaleString()} / {member.benefit_limit?.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div className="h-2 bg-primary-foreground/30 rounded-full">
              <div
                className="h-full bg-primary-foreground rounded-full"
                style={{ width: `${coveragePercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-primary-foreground/70 mt-2 text-center">
              Status: {member.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        )}
      </div>
      {member.is_active && (
        <Button onClick={handleDownloadCard} className="w-full rounded-t-none btn-accent">
          <Download className="mr-2 h-4 w-4" /> Download Card
        </Button>
      )}
    </Card>
  );
}