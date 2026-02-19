import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Archive, RotateCcw, Lock, Unlock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

type Equipment = Tables<"equipment">;

const CONDITIONS = ["excellent", "good", "fair", "bad", "damaged"] as const;
type ConditionCounts = Partial<Record<string, number>>;

const CATEGORY_LABELS: Record<string, string> = {
  audio: "Audio", video: "Video", lighting: "Lighting",
  presentation: "Presentation", cables_accessories: "Cables & Accessories", other: "Other",
};

export default function AdminInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "audio" as string,
    notes: "",
    total_quantity: 1,
    quantity_available: 1,
    quantity_reserved: 0,
    condition_counts: { good: 1 } as ConditionCounts,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["admin-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("is_retired", false).eq("is_reserved", false).order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const { data: reservedEquipment = [] } = useQuery({
    queryKey: ["admin-equipment-reserved"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("is_retired", false).eq("is_reserved", true).order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const { data: archivedEquipment = [] } = useQuery({
    queryKey: ["admin-equipment-archived"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("is_retired", true).order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-equipment"] });
    queryClient.invalidateQueries({ queryKey: ["admin-equipment-reserved"] });
    queryClient.invalidateQueries({ queryKey: ["admin-equipment-archived"] });
  };

  const getMainCondition = (counts: ConditionCounts): string => {
    let max = 0; let main = "good";
    for (const [k, v] of Object.entries(counts)) { if ((v ?? 0) > max) { max = v ?? 0; main = k; } }
    return main;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const mainCondition = getMainCondition(form.condition_counts) as Equipment["condition"];
      const payload = {
        name: form.name,
        category: form.category as Equipment["category"],
        condition: mainCondition,
        notes: form.notes || null,
        is_available: form.quantity_available > 0,
        total_quantity: form.total_quantity,
        quantity_available: form.quantity_available,
        quantity_reserved: form.quantity_reserved,
        condition_counts: form.condition_counts as unknown as Json,
      };
      if (editing) {
        const { error } = await supabase.from("equipment").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); toast({ title: editing ? "Updated" : "Added", description: `${form.name} has been ${editing ? "updated" : "added"}.` }); closeDialog(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("equipment").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast({ title: "Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const retireMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("equipment").update({ is_retired: true }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast({ title: "Archived", description: "Item moved to archive." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("equipment").update({ is_retired: false, is_reserved: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast({ title: "Restored", description: "Item restored to active inventory." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reserveMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("equipment").update({ is_reserved: true }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast({ title: "Reserved", description: "Item moved to reserved. It won't appear on the public page." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unreserveMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("equipment").update({ is_reserved: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast({ title: "Unreserved", description: "Item is now active and visible on the public page." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => { setEditing(null); setForm({ name: "", category: "audio", notes: "", total_quantity: 1, quantity_available: 1, quantity_reserved: 0, condition_counts: { good: 1 } }); setDialogOpen(true); };
  const openEdit = (item: Equipment) => {
    setEditing(item);
    const counts = (item as any).condition_counts as ConditionCounts ?? { [item.condition]: item.total_quantity };
    setForm({ name: item.name, category: item.category, notes: item.notes || "", total_quantity: item.total_quantity, quantity_available: item.quantity_available, quantity_reserved: (item as any).quantity_reserved ?? 0, condition_counts: counts });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const filtered = equipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const filteredReserved = reservedEquipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const filteredArchived = archivedEquipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

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

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active ({equipment.length})</TabsTrigger>
          <TabsTrigger value="reserved">Reserved ({reservedEquipment.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedEquipment.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
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
                        {item.quantity_available} / {item.total_quantity}
                        {((item as any).quantity_reserved ?? 0) > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({(item as any).quantity_reserved} reserved)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries((item as any).condition_counts ?? {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                            <Badge key={k} variant={k === "excellent" || k === "good" ? "default" : k === "fair" ? "secondary" : "destructive"} className="text-xs">
                              {v as number} {k.charAt(0).toUpperCase() + k.slice(1)}
                            </Badge>
                          ))}
                          {Object.keys((item as any).condition_counts ?? {}).length === 0 && (
                            <Badge variant={item.condition === "excellent" || item.condition === "good" ? "default" : item.condition === "fair" ? "secondary" : "destructive"}>
                              {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.quantity_available > 0 ? "default" : "secondary"}>
                          {item.quantity_available > 0 ? "Available" : "All Checked Out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => reserveMutation.mutate(item.id)} title="Reserve — hide from public"><Lock className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => retireMutation.mutate(item.id)} title="Archive"><Archive className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{item.name}" from inventory. This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No equipment found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reserved">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReserved.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                      <TableCell>
                        {item.quantity_available} / {item.total_quantity}
                        {((item as any).quantity_reserved ?? 0) > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({(item as any).quantity_reserved} reserved)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries((item as any).condition_counts ?? {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                            <Badge key={k} variant={k === "excellent" || k === "good" ? "default" : k === "fair" ? "secondary" : "destructive"} className="text-xs">
                              {v as number} {k.charAt(0).toUpperCase() + k.slice(1)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => unreserveMutation.mutate(item.id)} title="Make active"><Unlock className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => retireMutation.mutate(item.id)} title="Archive"><Archive className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive" title="Delete permanently"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{item.name}". This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredReserved.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No reserved equipment</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchived.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                      <TableCell>
                        <Badge variant={item.condition === "excellent" ? "default" : item.condition === "good" ? "default" : item.condition === "fair" ? "secondary" : "destructive"}>
                          {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => restoreMutation.mutate(item.id)} title="Restore"><RotateCcw className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive" title="Delete permanently"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{item.name}". This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredArchived.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No archived equipment</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
            <DialogDescription>{editing ? "Update equipment details." : "Add a new piece of equipment to inventory."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shure SM58 Microphone" /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Total Quantity</Label>
                <Input type="number" min={1} value={form.total_quantity} onChange={(e) => {
                  const total = Math.max(1, parseInt(e.target.value) || 1);
                  const reserved = Math.min(form.quantity_reserved, total);
                  const available = Math.min(form.quantity_available, total - reserved);
                  setForm({ ...form, total_quantity: total, quantity_reserved: reserved, quantity_available: available });
                }} />
              </div>
              <div>
                <Label>Available</Label>
                <Input type="number" min={0} max={form.total_quantity - form.quantity_reserved} value={form.quantity_available} onChange={(e) => {
                  setForm({ ...form, quantity_available: Math.max(0, Math.min(form.total_quantity - form.quantity_reserved, parseInt(e.target.value) || 0)) });
                }} />
              </div>
              <div>
                <Label>Reserved</Label>
                <Input type="number" min={0} max={form.total_quantity} value={form.quantity_reserved} onChange={(e) => {
                  const reserved = Math.max(0, Math.min(form.total_quantity, parseInt(e.target.value) || 0));
                  const available = Math.min(form.quantity_available, form.total_quantity - reserved);
                  setForm({ ...form, quantity_reserved: reserved, quantity_available: available });
                }} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Condition Breakdown</Label>
              <div className="space-y-2 rounded-md border p-3">
                {CONDITIONS.map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-24 text-sm capitalize">{c}</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={form.condition_counts[c] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setForm({ ...form, condition_counts: { ...form.condition_counts, [c]: val } });
                      }}
                    />
                  </div>
                ))}
                {(() => {
                  const sum = Object.values(form.condition_counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
                  return sum !== form.total_quantity ? (
                    <p className="text-xs text-destructive mt-1">Condition counts ({sum}) must equal total quantity ({form.total_quantity})</p>
                  ) : null;
                })()}
              </div>
            </div>
            
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Serial number, notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending || (Object.values(form.condition_counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) !== form.total_quantity}>
              {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
