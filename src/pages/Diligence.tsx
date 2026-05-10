import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FolderOpen, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

interface Room { id: string; name: string; description: string | null; created_at: string; }

const Diligence = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("diligence_rooms").select("id,name,description,created_at").order("created_at", { ascending: false });
      setRooms((data ?? []) as Room[]);
      setLoading(false);
    })();
  }, [user]);

  const createRoom = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await (supabase as any).from("diligence_rooms").insert({
        user_id: user.id, name: name.trim(), description: description.trim() || null,
      }).select("id").single();
      if (error) throw error;
      navigate(`/app/diligence/${data.id}`);
    } catch (e: any) {
      toast.error("Could not create room", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell title="Diligence" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary-glow"><Plus className="h-4 w-4" />New room</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">New diligence room</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Room name (e.g. Project Phoenix — NDA review)" value={name} onChange={e => setName(e.target.value)} />
            <Textarea placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={createRoom} disabled={!name.trim() || creating} className="bg-primary hover:bg-primary-glow">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="container max-w-5xl py-8">
        <p className="mb-6 text-muted-foreground">Upload a stack of documents, define your questions, and let AI fill in the matrix with verbatim citations.</p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
        ) : rooms.length === 0 ? (
          <div className="border border-dashed border-border bg-card p-10 text-center">
            <ScanSearch className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-3 font-serif text-lg font-semibold text-primary">No diligence rooms yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create one to start a documents × questions review.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map(r => (
              <Link key={r.id} to={`/app/diligence/${r.id}`} className="block border border-border bg-card p-5 transition-colors hover:border-accent">
                <div className="flex items-center gap-2 text-accent"><FolderOpen className="h-4 w-4" /><span className="font-mono text-xs uppercase tracking-wider">Room</span></div>
                <h3 className="mt-2 font-serif text-lg font-semibold text-primary">{r.name}</h3>
                {r.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
                <p className="mt-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Diligence;
