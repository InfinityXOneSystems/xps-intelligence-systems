import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle } from "lucide-react";
import xpsLogo from "@/assets/xps-logo.png";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const JOB_TITLES = [
  "Sales Representative",
  "Senior Sales Rep",
  "Territory Manager",
  "Regional Manager",
  "Branch Manager",
  "Owner",
];

const TERRITORY_SUGGESTIONS = [
  "Southeast FL",
  "Central FL",
  "Southwest FL",
  "Northeast FL",
  "Northwest FL",
];

const SPECIALTIES = [
  "Epoxy Flooring",
  "Polished Concrete",
  "Stained Concrete",
  "Decorative Overlays",
  "Concrete Grinding",
  "Commercial",
  "Residential",
  "Industrial",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 - Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Step 2 - Professional
  const [jobTitle, setJobTitle] = useState("");
  const [division, setDivision] = useState("");
  const [territory, setTerritory] = useState("");
  const [customTerritory, setCustomTerritory] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const effectiveTerritory = territory === "Custom..." ? customTerritory : territory;

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      await api.patch("/profile", {
        full_name: fullName || undefined,
        job_title: jobTitle,
        territory: effectiveTerritory,
        specialty: specialties.join(", "),
        division,
        onboarding_complete: true,
      });
      navigate("/dashboard");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { n: 1, label: "Personal" },
    { n: 2, label: "Professional" },
    { n: 3, label: "Confirm" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={xpsLogo} alt="XPS" className="h-10 w-10" />
          <span className="text-sm font-bold tracking-wider text-foreground">XPS INTELLIGENCE</span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center mb-8 gap-0">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step > s.n
                    ? "bg-primary border-primary text-primary-foreground"
                    : step === s.n
                    ? "border-primary text-primary bg-card"
                    : "border-border text-muted-foreground bg-card"
                }`}>
                  {step > s.n ? <CheckCircle2 className="h-5 w-5" /> : s.n}
                </div>
                <span className={`text-[10px] mt-1 tracking-wide uppercase ${step === s.n ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-16 mb-4 mx-1 ${step > s.n ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Personal Information</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us a bit about yourself</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">First Name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Last Name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" className="mt-1 bg-background border-border" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Profile Photo URL <span className="text-muted-foreground/60">(optional)</span></Label>
                <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." className="mt-1 bg-background border-border" />
              </div>
              <Button variant="gold" className="w-full mt-2" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Professional Details</h2>
                <p className="text-sm text-muted-foreground mt-1">Help us personalize your experience</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Job Title</Label>
                <Select value={jobTitle} onValueChange={setJobTitle}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue placeholder="Select your role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TITLES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Division / Branch</Label>
                <Input value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Miami Branch" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Territory</Label>
                <Select value={territory} onValueChange={setTerritory}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue placeholder="Select your territory..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TERRITORY_SUGGESTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="Custom...">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {territory === "Custom..." && (
                  <Input value={customTerritory} onChange={(e) => setCustomTerritory(e.target.value)} placeholder="Enter your territory" className="mt-2 bg-background border-border" />
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Specialty Areas</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTIES.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox
                        id={`specialty-${s}`}
                        checked={specialties.includes(s)}
                        onCheckedChange={() => toggleSpecialty(s)}
                      />
                      <label htmlFor={`specialty-${s}`} className="text-sm text-foreground cursor-pointer">{s}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button variant="gold" className="flex-1" onClick={() => setStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Confirm Your Setup</h2>
                <p className="text-sm text-muted-foreground mt-1">Review and complete your profile</p>
              </div>
              <div className="space-y-3 bg-background rounded-lg p-4 border border-border text-sm">
                <SummaryRow label="Name" value={fullName || "—"} />
                <SummaryRow label="Email" value={user?.email || "—"} />
                <SummaryRow label="Phone" value={phone || "—"} />
                <SummaryRow label="Job Title" value={jobTitle || "—"} />
                <SummaryRow label="Division" value={division || "—"} />
                <SummaryRow label="Territory" value={effectiveTerritory || "—"} />
                <SummaryRow label="Specialties" value={specialties.length > 0 ? specialties.join(", ") : "—"} />
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button variant="gold" className="flex-1" onClick={handleComplete} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Step {step} of 3 — XPS Intelligence Onboarding
        </p>
      </div>
    </div>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

export default Onboarding;
