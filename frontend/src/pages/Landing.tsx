import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Sources from "../components/Sources";
import HowItWorks from "../components/HowItWorks";
import Features from "../components/Features";
import DecisionMatrix from "../components/DecisionMatrix";
import FAQ from "../components/FAQ";
import Footer from "../components/Footer";

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
