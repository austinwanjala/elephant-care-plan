import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, CreditCard, QrCode, Building2, Users, ArrowRight, CheckCircle, Phone, Mail } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";


const Index = () => {
  const { settings } = useSystemSettings();

  const app_name = settings.app_name || "Elephant Dental";
  const hero_title = settings.hero_title || "Dental Insurance That Doubles Your Investment";
  const hero_subtitle = settings.hero_subtitle || "Pay KES 500, get KES 1,000 coverage. Simple, affordable dental care for you and your family at Elephant Dental Hospital.";
  const footer_text = settings.footer_text || "Providing accessible oral healthcare for everyone across Kenya.";
  const copyright_text = settings.copyright_text || "© 2024 Elephant Dental Hospital. All rights reserved.";
  const contact_phone = settings.contact_phone || "+254 700 000 000";
  const contact_email = settings.contact_email || "info@elephantdental.co.ke";


  const features = [
    {
      icon: CreditCard,
      title: "Simple Contributions",
      description: "Pay KES 500 via M-Pesa and get KES 1,000 in dental coverage instantly.",
    },
    {
      icon: Shield,
      title: "2× Coverage Guarantee",
      description: "Every contribution is doubled. Your health investment grows with us.",
    },
    {
      icon: QrCode,
      title: "Digital Insurance Card",
      description: "Get your unique QR code. Just scan at any branch for instant service.",
    },
    {
      icon: Building2,
      title: "Multiple Branches",
      description: "Access quality dental care at any of our locations across Kenya.",
    },
  ];

  const benefits = [
    "No paperwork required",
    "Instant coverage activation",
    "Family-friendly plans",
    "24/7 customer support",
    "Transparent claim process",
    "Affordable monthly rates",
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="glass-effect fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-serif font-bold text-foreground">{app_name}</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#branches" className="nav-link">Branches</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/register">
              <Button className="btn-primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-gradient pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-primary-foreground mb-6 leading-tight">
              {hero_title}
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8">
              {hero_subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="btn-accent text-lg px-8 py-6">
                  Join Now <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Member Login
                </Button>
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap justify-center gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-foreground">2×</p>
                <p className="text-primary-foreground/70">Coverage Multiplier</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-foreground">3+</p>
                <p className="text-primary-foreground/70">Hospital Branches</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-primary-foreground">5K+</p>
                <p className="text-primary-foreground/70">Happy Members</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Why Choose {app_name}?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We've designed the simplest dental insurance scheme in Kenya. No complicated terms, just straightforward coverage.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="stat-card text-center"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg">
              Three simple steps to dental coverage
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Register", description: "Sign up with your details and choose your preferred branch" },
              { step: "2", title: "Pay via M-Pesa", description: "Make your contribution using STK Push. Minimum KES 500" },
              { step: "3", title: "Get Your Card", description: "Receive your digital insurance card with QR code instantly" },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-primary">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">
                Member Benefits
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Join thousands of Kenyans who trust {app_name} for their dental care needs.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="qr-card">
              <div className="text-center">
                <div className="w-24 h-24 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
                  <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-16 h-16 object-contain" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Your Digital Card</h3>
                <p className="text-muted-foreground text-sm mb-4">Sample Member Card</p>
                <div className="bg-muted rounded-lg p-4 inline-block">
                  <QrCode className="h-24 w-24 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">ED001234</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="hero-gradient py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Join {app_name} today and give your family the dental care they deserve.
          </p>
          <Link to="/register">
            <Button size="lg" className="btn-accent text-lg px-8 py-6">
              Register Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  <img src="/img/elephant-logo.png" alt="Elephant Logo" className="w-8 h-8 object-contain" />
                </div>
                <span className="text-xl font-serif font-bold text-foreground">{app_name}</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs">
                {footer_text}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Contact Us</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {contact_phone}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {contact_email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Quick Links</h4>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/login" className="hover:text-primary">Member Login</Link>
                <Link to="/register" className="hover:text-primary">Join Scheme</Link>
                <Link to="/terms-of-service" className="hover:text-primary">Terms of Service</Link>
                <Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-xs">
              {copyright_text}
            </p>
            <div className="flex items-center gap-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">5,000+ Members</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;