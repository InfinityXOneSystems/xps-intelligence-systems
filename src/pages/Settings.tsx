import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Settings as SettingsIcon, User, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [territory, setTerritory] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setTerritory(user.territory || "");
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch("/profile", { full_name: fullName, territory });
      toast({ title: "Profile saved", description: "Your changes have been saved." });
    } catch {
      toast({ title: "Save failed", description: "Could not save your profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your account, preferences, and team settings</p>
        </div>

        {/* Profile */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 bg-card border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user?.email || ""} className="mt-1 bg-card border-border" disabled />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Territory</Label>
              <Input value={territory} onChange={(e) => setTerritory(e.target.value)} className="mt-1 bg-card border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Input value={user?.job_title || user?.role || ""} className="mt-1 bg-card border-border" disabled />
            </div>
          </div>
          <Button variant="gold" size="sm" className="mt-4" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Notifications */}
        <div className="bg-gradient-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-3">
            {["Email notifications for new leads", "SMS alerts for deal updates", "Weekly pipeline summary", "AI assistant daily briefing"].map((item) => (
              <div key={item} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-foreground">{item}</span>
                <div className="h-5 w-9 bg-primary/30 rounded-full relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-primary rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
