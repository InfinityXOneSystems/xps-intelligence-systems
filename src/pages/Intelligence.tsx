import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Cpu, BookOpen, Zap, FlaskConical, Plus, Search, Package,
  Wrench, Beaker, TrendingUp, RefreshCw, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface TaxonomyItem {
  name: string;
  description?: string;
  category: string;
}

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  relevance_score?: number;
  created_at: string;
  source?: string;
}

interface DistillationItem {
  id: string;
  source_url?: string;
  source_type?: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  product: Package,
  technique: FlaskConical,
  equipment: Wrench,
  chemical: Beaker,
  market_segment: TrendingUp,
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Products",
  technique: "Techniques",
  equipment: "Equipment",
  chemical: "Chemicals",
  market_segment: "Market Segments",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  processing: "bg-blue-500/10 text-blue-400",
  completed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
};

function authHeaders(token: string | null) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function Intelligence() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [kbSearch, setKbSearch] = useState("");
  const [distillUrl, setDistillUrl] = useState("");
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: "", content: "", category: "", tags: "", source: "" });

  const { data: taxonomyData, isLoading: taxLoading } = useQuery({
    queryKey: ["intelligence-taxonomy"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/intelligence/taxonomy`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load taxonomy");
      return res.json() as Promise<{ taxonomy: Record<string, TaxonomyItem[]>; total: number }>;
    },
  });

  const { data: kbData, isLoading: kbLoading } = useQuery({
    queryKey: ["intelligence-kb"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/intelligence/kb`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load knowledge base");
      return res.json() as Promise<{ articles: KBArticle[]; total: number }>;
    },
  });

  const { data: distillData, isLoading: distillLoading } = useQuery({
    queryKey: ["intelligence-distillation"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/intelligence/distillation`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load distillation queue");
      return res.json() as Promise<{ queue: DistillationItem[] }>;
    },
  });

  const addArticleMutation = useMutation({
    mutationFn: async (article: typeof newArticle) => {
      const res = await fetch(`${API_BASE}/api/intelligence/kb`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          category: article.category || undefined,
          source: article.source || undefined,
          tags: article.tags ? article.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed to add article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intelligence-kb"] });
      toast({ title: "Article added", description: "Knowledge base article saved." });
      setAddArticleOpen(false);
      setNewArticle({ title: "", content: "", category: "", tags: "", source: "" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const distillMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`${API_BASE}/api/intelligence/distillation`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ source_url: url, source_type: "website" }),
      });
      if (!res.ok) throw new Error("Failed to queue distillation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intelligence-distillation"] });
      toast({ title: "Queued", description: "URL added to distillation queue." });
      setDistillUrl("");
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const taxonomy = taxonomyData?.taxonomy ?? {};
  const articles = kbData?.articles ?? [];
  const queue = distillData?.queue ?? [];

  const filteredArticles = articles.filter(
    (a) =>
      !kbSearch ||
      a.title.toLowerCase().includes(kbSearch.toLowerCase()) ||
      a.category?.toLowerCase().includes(kbSearch.toLowerCase()) ||
      a.tags?.some((t) => t.toLowerCase().includes(kbSearch.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Intelligence Lab</h1>
            <p className="text-sm text-muted-foreground">XPS industry taxonomy, knowledge base & distillation system</p>
          </div>
        </div>

        <Tabs defaultValue="taxonomy">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
            <TabsTrigger value="distillation">Distillation</TabsTrigger>
            <TabsTrigger value="products">XPS Products</TabsTrigger>
          </TabsList>

          {/* ---- TAXONOMY ---- */}
          <TabsContent value="taxonomy" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {taxLoading ? "Loading…" : `${taxonomyData?.total ?? 0} taxonomy entries across ${Object.keys(taxonomy).length} categories`}
              </p>
            </div>
            {taxLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading taxonomy…</div>
            ) : Object.keys(taxonomy).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No taxonomy data available.</div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(taxonomy).map(([cat, items]) => {
                  const Icon = CATEGORY_ICONS[cat] ?? Package;
                  return (
                    <Card key={cat} className="bg-gradient-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {CATEGORY_LABELS[cat] ?? cat}
                          <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {items.map((item) => (
                          <div key={item.name} className="py-2 border-b border-border/50 last:border-0">
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- KNOWLEDGE BASE ---- */}
          <TabsContent value="kb" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles, tags, categories…"
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={addArticleOpen} onOpenChange={setAddArticleOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add Article
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Knowledge Base Article</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="art-title">Title *</Label>
                      <Input id="art-title" value={newArticle.title} onChange={(e) => setNewArticle((p) => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="art-content">Content *</Label>
                      <Textarea id="art-content" rows={5} value={newArticle.content} onChange={(e) => setNewArticle((p) => ({ ...p, content: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="art-cat">Category</Label>
                        <Input id="art-cat" placeholder="e.g. technique" value={newArticle.category} onChange={(e) => setNewArticle((p) => ({ ...p, category: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="art-tags">Tags (comma-separated)</Label>
                        <Input id="art-tags" placeholder="epoxy, floor" value={newArticle.tags} onChange={(e) => setNewArticle((p) => ({ ...p, tags: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="art-source">Source URL</Label>
                      <Input id="art-source" placeholder="https://…" value={newArticle.source} onChange={(e) => setNewArticle((p) => ({ ...p, source: e.target.value }))} />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newArticle.title || !newArticle.content || addArticleMutation.isPending}
                      onClick={() => addArticleMutation.mutate(newArticle)}
                    >
                      {addArticleMutation.isPending ? "Saving…" : "Save Article"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {kbLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading knowledge base…</div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Knowledge base is empty.</p>
                <p className="text-sm">Add your first article or run the distillation system.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map((a) => (
                  <Card key={a.id} className="bg-gradient-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {a.category && <Badge variant="outline" className="text-xs">{a.category}</Badge>}
                            {a.tags?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {typeof a.relevance_score === "number" && (
                            <span className="text-xs text-primary font-semibold">{a.relevance_score.toFixed(1)} ★</span>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- DISTILLATION ---- */}
          <TabsContent value="distillation" className="space-y-4 mt-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" /> Add URL to Distillation Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Input
                  placeholder="https://example.com/flooring-guide"
                  value={distillUrl}
                  onChange={(e) => setDistillUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="default"
                  disabled={!distillUrl || distillMutation.isPending}
                  onClick={() => distillMutation.mutate(distillUrl)}
                >
                  {distillMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Queue URL"}
                </Button>
              </CardContent>
            </Card>

            {distillLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading queue…</div>
            ) : queue.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Distillation queue is empty.</p>
                <p className="text-sm">Add a URL above to queue content for AI processing.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => {
                  const StatusIcon = item.status === "completed" ? CheckCircle2 : item.status === "failed" ? AlertCircle : Clock;
                  return (
                    <Card key={item.id} className="bg-gradient-card border-border">
                      <CardContent className="p-4 flex items-center gap-3">
                        <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.source_url || "(manual content)"}</p>
                          <p className="text-xs text-muted-foreground">{item.source_type} · {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.status]}`}>
                          {item.status}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- XPS PRODUCTS ---- */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Pre-loaded XPS product intelligence and training catalog.</p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Epoxy Systems",
                  icon: Package,
                  items: ["100% Solid Epoxy", "Water-Based Epoxy", "Solvent-Based Epoxy", "Metallic Epoxy"],
                },
                {
                  title: "Concrete Products",
                  icon: Beaker,
                  items: ["Polishing Systems", "Stain Systems", "Overlay Systems", "Crack Repair"],
                },
                {
                  title: "Equipment",
                  icon: Wrench,
                  items: ["Diamond Grinders", "Planetary Grinders", "Shot Blasters", "Vacuum Systems"],
                },
                {
                  title: "Training",
                  icon: FlaskConical,
                  items: ["Certification Programs", "Online Courses", "Hands-on Classes"],
                },
              ].map(({ title, icon: Icon, items }) => (
                <Card key={title} className="bg-gradient-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" /> {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((item) => (
                      <div key={item} className="py-1.5 border-b border-border/50 last:border-0">
                        <p className="text-sm text-foreground">{item}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
