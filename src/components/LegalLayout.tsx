import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Phone, Mail, Globe, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LegalLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
}

export const LegalLayout = ({ children, title, subtitle }: LegalLayoutProps) => {
    return (
        <div className="min-h-screen bg-slate-50 font-serif">
            {/* Premium Header */}
            <header className="bg-white border-b-4 border-lime-500 shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <img src="/img/elephant-logo.png" alt="Logo" className="w-16 h-16 object-contain" />
                            <div>
                                <div className="flex text-3xl font-black tracking-tighter leading-none">
                                    <span className="text-orange-600">ELEPHANT</span>
                                    <span className="text-lime-600 ml-2">DENTAL</span>
                                </div>
                                <p className="text-[10px] text-slate-500 italic font-bold tracking-widest uppercase mt-1">
                                    ...the epitome of dental solutions
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end text-xs text-slate-600 space-y-1">
                            <div className="bg-lime-500 text-white px-3 py-1 font-bold rounded mb-1 text-[10px]">HEAD OFFICE</div>
                            <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-orange-500" /> P. O. Box 643 - 60200, Meru</div>
                            <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-orange-500" /> +254 710 500 500</div>
                            <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-orange-500" /> info@elephantdental.org</div>
                            <div className="flex items-center gap-1"><Globe className="w-3 h-3 text-orange-500" /> www.elephantdental.org</div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-orange-600 transition-colors mb-10 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold text-sm uppercase tracking-widest">Back to Homepage</span>
                    </Link>

                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                        {/* Page Title Overlay */}
                        <div className="bg-gradient-to-r from-orange-500 to-lime-500 p-10 text-white text-center">
                            <h1 className="text-4xl md:text-5xl font-black mb-4 drop-shadow-md">{title}</h1>
                            <p className="text-white/90 text-lg italic font-medium">{subtitle}</p>
                        </div>

                        {/* Document Content */}
                        <div className="p-8 md:p-12 prose prose-slate max-w-none 
              prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
              prose-p:text-slate-600 prose-p:leading-relaxed
              prose-strong:text-orange-600 prose-strong:font-bold
              prose-li:text-slate-600
              prose-h2:border-b-2 prose-h2:border-lime-100 prose-h2:pb-2 prose-h2:mt-12
              ">
                            {children}
                        </div>

                        {/* Accept Button / Footer */}
                        <div className="bg-slate-50 p-8 border-t border-slate-100 flex flex-col items-center gap-4">
                            <p className="text-xs text-slate-400 text-center max-w-sm">
                                By using our services, you acknowledge that you have read and understood these terms.
                                Last Updated: February 2024.
                            </p>
                            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-6 rounded-2xl font-bold text-lg shadow-lg shadow-orange-200">
                                <Link to="/register">Join the Scheme Now</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="container mx-auto px-4 py-8 text-center text-slate-400 text-sm">
                <p>&copy; {new Date().getFullYear()} Elephant Dental Hospital. All Rights Reserved.</p>
            </footer>
        </div>
    );
};
