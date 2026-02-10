import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Package, CheckCircle, AlertTriangle, ArrowRightLeft, Archive, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CONDITIONS = ["excellent", "good", "fair", "bad", "damaged"] as const;

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forceReturnTarget, setForceReturnTarget] = useState<any>(null);
  const [forceReturnConditionCounts, setForceReturnConditionCounts] = useState<Record<string, number>>({});

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("is_retired", false);
      if (error) throw error;
      return data;
    },
  });

  const { data: archivedCount = 0 } = useQuery({
    queryKey: ["equipment-archived-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("equipment").select("*", { count: "exact", head: true }).eq("is_retired", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: activeCheckouts = [] } = useQuery({
    queryKey: ["active-checkouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_log")
        .select("*, equipment(name, category)")
        .is("return_date", null)
        .order("checkout_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const forceReturnMutation = useMutation({
    mutationFn: async () => {
      const checkout = forceReturnTarget;
      if (!checkout) return;
      const totalReturning = Object.values(forceReturnConditionCounts).reduce((a, b) => a + b, 0);
      const remaining = checkout.quantity - (checkout.quantity_returned ?? 0);
      if (totalReturning < 1 || totalReturning > remaining) {
        throw new Error(`Must return between 1 and ${remaining} items.`);
      }
      const newQtyReturned = (checkout.quantity_returned ?? 0) + totalReturning;
      const fullyReturned = newQtyReturned >= checkout.quantity;
      const mainCondition = Object.entries(forceReturnConditionCounts).reduce((a, b) => b[1] > a[1] ? b : a, ["good", 0])[0];
      const { error: logError } = await supabase
        .from("checkout_log")
        .update({
          quantity_returned: newQtyReturned,
          ...(fullyReturned ? { return_date: new Date().toISOString() } : {}),
          returned_by: "Admin (force return)",
          condition_on_return: mainCondition as any,
        })
        .eq("id", checkout.id);
      if (logError) throw logError;
      // Restore quantity and update condition_counts
      const { data: eq } = await supabase.from("equipment").select("quantity_available, total_quantity, condition_counts").eq("id", checkout.equipment_id).single();
      const restored = Math.min((eq?.quantity_available ?? 0) + totalReturning, eq?.total_quantity ?? totalReturning);
      const counts = (eq?.condition_counts ?? {}) as Record<string, number>;
      for (const [cond, qty] of Object.entries(forceReturnConditionCounts)) {
        if (qty > 0) counts[cond] = (counts[cond] ?? 0) + qty;
      }
      const overallMain = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a), ["good", 0])[0];
      const { error: eqError } = await supabase
        .from("equipment")
        .update({ quantity_available: restored, is_available: true, condition: overallMain as any, condition_counts: counts })
        .eq("id", checkout.equipment_id);
      if (eqError) throw eqError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-checkouts"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-all"] });
      toast({ title: "Force returned", description: "Item has been returned by admin." });
      setForceReturnTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openForceReturn = (checkout: any) => {
    const remaining = checkout.quantity - (checkout.quantity_returned ?? 0);
    setForceReturnTarget(checkout);
    const checkoutCounts = (checkout.checkout_condition_counts ?? {}) as Record<string, number>;
    const total = Object.values(checkoutCounts).reduce((a: number, b: number) => a + b, 0);
    setForceReturnConditionCounts(total > 0 ? checkoutCounts : { good: remaining });
  };

  const forceReturnMax = forceReturnTarget ? forceReturnTarget.quantity - (forceReturnTarget.quantity_returned ?? 0) : 0;
  const forceReturnSum = Object.values(forceReturnConditionCounts).reduce((a, b) => a + b, 0);

  const total = equipment.reduce((sum, e) => sum + e.total_quantity, 0);
  const available = equipment.reduce((sum, e) => sum + e.quantity_available, 0);
  const checkedOut = total - available;
  const damaged = equipment.reduce((sum, e) => {
    const counts = (e as any).condition_counts as Record<string, number> | null;
    if (counts) return sum + (counts.damaged ?? 0) + (counts.bad ?? 0);
    return sum + (e.condition === "damaged" || e.condition === "bad" ? e.total_quantity : 0);
  }, 0);

  const stats = [
    { label: "Total Items", value: total, icon: Package, color: "text-primary" },
    { label: "Available", value: available, icon: CheckCircle, color: "text-success" },
    { label: "Checked Out", value: checkedOut, icon: ArrowRightLeft, color: "text-warning" },
    { label: "Damaged", value: damaged, icon: AlertTriangle, color: "text-destructive" },
    { label: "Archived", value: archivedCount, icon: Archive, color: "text-muted-foreground" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Currently Checked Out</CardTitle>
        </CardHeader>
        <CardContent>
          {activeCheckouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equipment currently checked out.</p>
          ) : (
            <div className="space-y-3">
              {activeCheckouts.map((c: any) => {
                const remaining = c.quantity - (c.quantity_returned ?? 0);
                return (
                   <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                     <div>
                       <p className="font-medium">
                         {c.equipment?.name ?? "Unknown"}
                         <Badge variant="outline" className="ml-2">
                           Qty: {remaining}{c.quantity_returned > 0 ? ` (${c.quantity_returned} returned)` : ""}
                         </Badge>
                       </p>
                       <p className="text-sm text-muted-foreground">
                         {c.borrower_name}{c.team_name ? ` · ${c.team_name}` : ""} · PIN: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{c.pin || "—"}</code>
                       </p>
                       {c.notes && (
                         <p className="text-sm text-muted-foreground mt-1">📝 Checkout notes: {c.notes}</p>
                       )}
                       {c.return_notes && (
                         <p className="text-sm text-muted-foreground mt-1">📝 Return notes: {c.return_notes}</p>
                       )}
                     </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">Since {format(new Date(c.checkout_date), "MMM d, yyyy")}</p>
                        {c.expected_return && (
                          <Badge variant="outline" className="mt-1">
                            Due {format(new Date(c.expected_return), "MMM d")}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => openForceReturn(c)}
                        disabled={forceReturnMutation.isPending}
                      >
                        <Undo2 className="h-3 w-3" /> Force Return
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Force Return Dialog */}
      <Dialog open={!!forceReturnTarget} onOpenChange={(open) => !open && setForceReturnTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Return: {forceReturnTarget?.equipment?.name}</DialogTitle>
            <DialogDescription>
              Checked out by {forceReturnTarget?.borrower_name}. {forceReturnMax} item{forceReturnMax !== 1 ? "s" : ""} remaining. Specify quantity and condition.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Condition of Returned Items</Label>
              <div className="space-y-2 rounded-md border p-3">
                {CONDITIONS.map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-24 text-sm capitalize">{c}</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={forceReturnConditionCounts[c] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setForceReturnConditionCounts({ ...forceReturnConditionCounts, [c]: val });
                      }}
                    />
                  </div>
                ))}
                {forceReturnSum < 1 && <p className="text-xs text-destructive mt-1">Enter at least 1 item to return</p>}
                {forceReturnSum > forceReturnMax && <p className="text-xs text-destructive mt-1">Total ({forceReturnSum}) exceeds remaining ({forceReturnMax})</p>}
                {forceReturnSum >= 1 && forceReturnSum <= forceReturnMax && (
                  <p className="text-xs text-muted-foreground mt-1">Returning {forceReturnSum} of {forceReturnMax} item{forceReturnMax !== 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceReturnTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => forceReturnMutation.mutate()}
              disabled={forceReturnMutation.isPending || forceReturnSum < 1 || forceReturnSum > forceReturnMax}
            >
              {forceReturnMutation.isPending ? "Returning..." : "Confirm Force Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
