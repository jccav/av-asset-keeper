import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Archive } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Equipment = Tables<"equipment">;

const CATEGORY_LABELS: Record<string, string> = {
  audio: "Audio", video: "Video", lighting: "Lighting",
  presentation: "Presentation", cables_accessories: "Cables & Accessories",
};

export default function AdminInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ name: "", category: "audio" as string, condition: "good" as string, notes: "" });

  const { data: equipment = [] } = useQuery({
    queryKey: ["admin-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("is_retired", false).order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("equipment").update({
          name: form.name,
          category: form.category as Equipment["category"],
          condition: form.condition as Equipment["condition"],
          notes: form.notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert({
          name: form.name,
          category: form.category as Equipment["category"],
          condition: form.condition as Equipment["condition"],
          notes: form.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
      toast({ title: editing ? "Updated" : "Added", description: `${form.name} has been ${editing ? "updated" : "added"}.` });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const retireMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").update({ is_retired: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
      toast({ title: "Retired", description: "Item marked as out of service." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", category: "audio", condition: "good", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({ name: item.name, category: item.category, condition: item.condition, notes: item.notes || "" });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const filtered = equipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Equipment</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                  <TableCell>
                    <Badge variant={item.condition === "good" ? "default" : item.condition === "fair" ? "secondary" : "destructive"}>
                      {item.condition}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.is_available ? "default" : "secondary"}>
                      {item.is_available ? "Available" : "Checked Out"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => retireMutation.mutate(item.id)}><Archive className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No equipment found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
            <DialogDescription>{editing ? "Update equipment details." : "Add a new piece of equipment to inventory."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shure SM58 Microphone" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Serial number, notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
