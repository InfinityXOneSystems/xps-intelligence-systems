import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

export const HeroSection = () =>
<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
    {/* Background */}
    <div className="absolute inset-0">
      <img src={heroBg} alt="" className="w-full h-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
    </div>

    <div className="relative container mx-auto px-4 py-20 text-center">
      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="inline-flex items-center gap-2 border border-gold rounded-full px-4 py-1.5 mb-8">
      
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-primary font-medium tracking-wide">AI-Powered Sales Intelligence Platform</span>
      </motion.div>

      <motion.h1
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.1 }}
      className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.05] mb-6 max-w-5xl mx-auto">
      
        <span className="text-foreground">​XPS INTELLIGENCE </span>{" "}
        <span className="text-gradient-gold">
</span>
      </motion.h1>

      <motion.p initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.2 }}
    className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-slate-300">
      
        ​AI POWERED LEAD GENERATION AND INTEL SYSTEM         
      </motion.p>

      <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="flex flex-col sm:flex-row items-center justify-center gap-4">
      
        <Button variant="gold" size="xl" asChild>
          <Link to="/login">
            Get Started <ArrowRight className="ml-1 h-5 w-5" />
          </Link>
        </Button>
        <Button variant="gold-outline" size="lg" asChild>
          <Link to="/login">
            <Play className="h-4 w-4 mr-1" /> Watch Demo
          </Link>
        </Button>
      </motion.div>

      <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.6 }}
      className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
      
        {[
      { label: "Locations", value: "60+" },
      { label: "Sales Staff", value: "200+" },
      { label: "Leads Managed", value: "50K+" },
      { label: "Revenue Tracked", value: "$120M+" }].
      map((stat) =>
      <div key={stat.label} className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-gradient-gold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</div>
          </div>
      )}
      </motion.div>
    </div>
  </section>;