import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Sources from "@/components/landing/Sources";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import DecisionMatrix from "@/components/landing/DecisionMatrix";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Sources />
      <HowItWorks />
      <Features />
      <DecisionMatrix />
      <FAQ />
      <Footer />
    </div>
  );
}
