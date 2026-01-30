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
      const canvas = await html2canvas(cardRef.current, { scale: 2 }); // Scale for better resolution
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
    <Card className="qr-card p-6 flex flex-col items-center text-center">
      <div ref={cardRef} className="flex flex-col items-center text-center w-full"> {/* Wrap content to be captured */}
        <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">🐘</span>
        </div>
        <h3 className="font-serif font-bold text-foreground text-lg mb-1">
          {member.full_name}
        </h3>
        <p className="text-primary font-mono font-semibold mb-2">
          {member.member_number}
        </p>
        {member.membership_categories && (
          <Badge className="mb-4">{member.membership_categories.name}</Badge>
        )}

        {member.qr_code_data ? (
          <div className="bg-background rounded-xl p-4 inline-block mb-4">
            <QRCodeSVG
              value={member.qr_code_data}
              size={140}
              level="H"
              includeMargin
            />
          </div>
        ) : (
          <div className="bg-muted rounded-xl p-4 inline-block mb-4 text-muted-foreground">
            <User className="h-24 w-24" />
            <p className="text-sm mt-2">QR Code not active</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Scan at any branch for instant service
        </p>

        {member.is_active && (
          <div className="mt-4 w-full text-left">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
              <span>Coverage:</span>
              <span className="font-semibold text-foreground">
                KES {member.coverage_balance.toLocaleString()} / {member.benefit_limit?.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${coveragePercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      {member.is_active && (
        <Button onClick={handleDownloadCard} className="mt-6 w-full btn-primary">
          <Download className="mr-2 h-4 w-4" /> Download Card
        </Button>
      )}
    </Card>
  );
}