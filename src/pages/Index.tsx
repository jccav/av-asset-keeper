import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, ArrowRightLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import jccLogo from "@/assets/jcc-logo.png";
import type { Tables } from "@/integrations/supabase/types";

type Equipment = Tables<"equipment">;

const CATEGORY_LABELS: Record<string, string> = {
  audio: "Audio",
  video: "Video",
  lighting: "Lighting",
  presentation: "Presentation",
  cables_accessories: "Cables & Accessories",
  other: "Other",
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: "bg-emerald-700 text-white",
  good: "bg-success text-success-foreground",
  fair: "bg-warning text-warning-foreground",
  bad: "bg-orange-600 text-white",
  damaged: "bg-destructive text-destructive-foreground",
};

export default function Index() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [checkoutItem, setCheckoutItem] = useState<Equipment | null>(null);
  const [returnItem, setReturnItem] = useState<Equipment | null>(null);
  const [returnBorrower, setReturnBorrower] = useState("");
  const [returnTeam, setReturnTeam] = useState("");
  const [returnPin, setReturnPin] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnMaxQty, setReturnMaxQty] = useState(1);
  const [borrowerName, setBorrowerName] = useState("");
  const [checkoutPin, setCheckoutPin] = useState("");
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [locationUsed, setLocationUsed] = useState("");
  const [avMember, setAvMember] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutConditionCounts, setCheckoutConditionCounts] = useState<Record<string, number>>({ good: 1 });
  const [returnConditionCounts, setReturnConditionCounts] = useState<Record<string, number>>({ good: 1 });
  const [returnNotes, setReturnNotes] = useState("");
  const [mergeTarget, setMergeTarget] = useState<any>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("is_retired", false)
        .eq("is_reserved", false)
        .order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ forceMerge }: { forceMerge?: boolean } = {}) => {
      if (!checkoutItem) return;
      const checkoutTotal = Object.values(checkoutConditionCounts).reduce((a, b) => a + b, 0);
      if (checkoutTotal < 1) throw new Error("Specify at least 1 item to check out.");
      if (checkoutPin.length !== 4) throw new Error("PIN must be 4 digits.");

      const { data, error } = await supabase.functions.invoke("checkout", {
        body: {
          equipment_id: checkoutItem.id,
          borrower_name: borrowerName,
          team_name: teamName || null,
          expected_return: expectedReturn || null,
          notes: checkoutNotes || null,
          pin: checkoutPin,
          condition_counts: checkoutConditionCounts,
          force_merge: !!forceMerge,
          contact_number: contactNumber || null,
          location_used: locationUsed || null,
          av_member: avMember || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.merge_prompt) {
        setMergeTarget(data.existing);
        setShowMergeConfirm(true);
        return "merge_prompt";
      }
    },
    onSuccess: (result) => {
      if (result === "merge_prompt") return;
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Checked out!", description: `${checkoutItem?.name} has been signed out.` });
      resetCheckout();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returnItem) return;
      const { data, error } = await supabase.functions.invoke("return-equipment", {
        body: {
          equipment_id: returnItem.id,
          pin: returnPin,
          condition_counts: returnConditionCounts,
          return_notes: returnNotes || null,
          returned_by: borrowerName || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Returned!", description: `${returnItem?.name} has been checked back in.` });
      resetReturn();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetCheckout = () => {
    setCheckoutItem(null);
    setBorrowerName("");
    setCheckoutPin("");
    setCheckoutQty(1);
    setTeamName("");
    setContactNumber("");
    setLocationUsed("");
    setAvMember("");
    setExpectedReturn("");
    setCheckoutNotes("");
    setCheckoutConditionCounts({ good: 1 });
    setMergeTarget(null);
    setShowMergeConfirm(false);
  };

  const resetReturn = () => {
    setReturnItem(null);
    setReturnBorrower("");
    setReturnTeam("");
    setReturnPin("");
    setReturnQuantity(1);
    setReturnMaxQty(1);
    setTeamName("");
    setReturnConditionCounts({ good: 1 });
    setReturnNotes("");
  };

  const openReturn = async (item: Equipment) => {
    setReturnItem(item);
    const { data } = await supabase
      .rpc("get_active_checkouts", { p_equipment_id: item.id });
    const log = (data as any[])?.find((l: any) => (l.quantity - (l.quantity_returned ?? 0)) > 0);
    setReturnBorrower(log?.borrower_name ?? "Unknown");
    setReturnTeam(log?.team_name ?? "");
    const remaining = (log?.quantity ?? 1) - (log?.quantity_returned ?? 0);
    setReturnQuantity(remaining);
    setReturnMaxQty(remaining);
    // Default return conditions to remaining (scale down from checkout counts)
    const checkoutCounts = (log?.checkout_condition_counts ?? {}) as Record<string, number>;
    const totalCheckoutCounts = Object.values(checkoutCounts).reduce((a, b) => a + b, 0);
    if (totalCheckoutCounts > 0 && totalCheckoutCounts === remaining) {
      setReturnConditionCounts({ ...checkoutCounts });
    } else if (totalCheckoutCounts > 0 && remaining < totalCheckoutCounts) {
      // Scale proportionally to remaining
      const scaled: Record<string, number> = {};
      let assigned = 0;
      const entries = Object.entries(checkoutCounts).filter(([, v]) => v > 0);
      for (let i = 0; i < entries.length; i++) {
        const [cond, qty] = entries[i];
        if (i === entries.length - 1) {
          scaled[cond] = remaining - assigned;
        } else {
          const share = Math.round((qty / totalCheckoutCounts) * remaining);
          scaled[cond] = share;
          assigned += share;
        }
      }
      setReturnConditionCounts(scaled);
    } else {
      setReturnConditionCounts({ good: remaining });
    }
  };

  const filtered = equipment.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || e.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={jccLogo} alt="JCC Logo" className="h-9 w-9 object-contain" />
            <h1 className="text-xl font-bold tracking-tight">JCC AV Tracker</h1>
          </div>
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search & Filter */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Equipment Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-5 w-32 rounded bg-muted" /></CardHeader>
                <CardContent><div className="h-20 rounded bg-muted" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <img src={jccLogo} alt="JCC Logo" className="mx-auto mb-4 h-12 w-12 opacity-40" />
            <p className="text-lg">No equipment found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <Card key={item.id} className="flex flex-col justify-between transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">{item.name}</CardTitle>
                    <Badge
                      className={item.quantity_available > 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}
                    >
                      {item.quantity_available > 0 ? `${item.quantity_available} / ${item.total_quantity - ((item as any).quantity_reserved ?? 0)} Available` : "All Checked Out"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                    {(["damaged", "bad", "fair", "good", "excellent"] as const)
                      .filter((k) => (((item as any).condition_counts ?? {}) as Record<string, number>)[k] > 0)
                      .map((k) => {
                        const rawCounts = ((item as any).condition_counts ?? {}) as Record<string, number>;
                        const resCounts = ((item as any).reserved_condition_counts ?? {}) as Record<string, number>;
                        const v = (rawCounts[k] ?? 0) - (resCounts[k] ?? 0);
                        if (v <= 0) return null;
                        return (
                          <Badge key={k} className={CONDITION_COLORS[k]}>
                            {v} {k.charAt(0).toUpperCase() + k.slice(1)}
                          </Badge>
                        );
                      })}
                    {Object.keys(((item as any).condition_counts ?? {}) as Record<string, number>).length === 0 && (
                      <Badge className={CONDITION_COLORS[item.condition]}>
                        {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                      </Badge>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {item.quantity_available > 0 ? (
                      <Button className="w-full gap-2" onClick={() => { setCheckoutItem(item); const rawCounts = ((item as any).condition_counts ?? {}) as Record<string, number>; const resCounts = ((item as any).reserved_condition_counts ?? {}) as Record<string, number>; const visibleCounts: Record<string, number> = {}; for (const [k, v] of Object.entries(rawCounts)) { const vis = v - (resCounts[k] ?? 0); if (vis > 0) visibleCounts[k] = vis; } setCheckoutConditionCounts(Object.keys(visibleCounts).length > 0 ? visibleCounts : { good: 1 }); }}>
                        <ArrowRightLeft className="h-4 w-4" /> Check Out
                      </Button>
                    ) : null}
                    {item.quantity_available < (item.total_quantity - ((item as any).quantity_reserved ?? 0)) && (
                      <Button variant="outline" className="w-full gap-2" onClick={() => openReturn(item)}>
                        <ArrowRightLeft className="h-4 w-4" /> Return
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Checkout Dialog */}
      <Dialog open={!!checkoutItem} onOpenChange={(open) => !open && resetCheckout()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check Out: {checkoutItem?.name}</DialogTitle>
            <DialogDescription>
              {checkoutItem?.quantity_available !== undefined
                ? `${checkoutItem.quantity_available} of ${checkoutItem.total_quantity - ((checkoutItem as any).quantity_reserved ?? 0)} available.`
                : "Fill in your details to sign out this equipment."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="borrower">Your Name *</Label>
              <Input id="borrower" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="team">Who are you checking this out on behalf of? *</Label>
              <Input id="team" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Production Team, Pastor John, etc." />
            </div>
            <div>
              <Label htmlFor="contact">Contact # </Label>
              <Input id="contact" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g. 555-123-4567" />
            </div>
            <div>
              <Label htmlFor="location">Location Used</Label>
              <Input id="location" value={locationUsed} onChange={(e) => setLocationUsed(e.target.value)} placeholder="e.g. Main Sanctuary, Room 201" />
            </div>
            <div>
              <Label htmlFor="av-member">AV Member</Label>
              <Input id="av-member" value={avMember} onChange={(e) => setAvMember(e.target.value)} placeholder="AV team member handling this" />
            </div>
            <div>
              <Label htmlFor="pin">4-Digit PIN * <span className="text-xs text-muted-foreground">(you'll need this to return)</span></Label>
              <Input id="pin" value={checkoutPin} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCheckoutPin(v); }} placeholder="e.g. 1234" inputMode="numeric" maxLength={4} />
            </div>
            <div>
              <Label className="mb-2 block">Condition of Items Being Checked Out</Label>
              <div className="space-y-2 rounded-md border p-3">
                {(["excellent", "good", "fair", "bad", "damaged"] as const).map((c) => {
                  const rawCounts = ((checkoutItem as any)?.condition_counts ?? {}) as Record<string, number>;
                  const resCounts = ((checkoutItem as any)?.reserved_condition_counts ?? {}) as Record<string, number>;
                  const availForCondition = Math.max(0, (rawCounts[c] ?? 0) - (resCounts[c] ?? 0));
                  return (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-24 text-sm capitalize">{c}</span>
                    <Input
                      type="number"
                      min={0}
                      max={availForCondition}
                      className="h-8 w-20"
                      value={checkoutConditionCounts[c] ?? 0}
                      onChange={(e) => {
                        let val = Math.max(0, parseInt(e.target.value) || 0);
                        if (val > availForCondition) val = 0;
                        setCheckoutConditionCounts({ ...checkoutConditionCounts, [c]: val });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">/ {availForCondition} avail</span>
                  </div>
                  );
                })}
                {(() => {
                  const sum = Object.values(checkoutConditionCounts).reduce((a, b) => a + b, 0);
                  const max = checkoutItem?.quantity_available ?? 1;
                  if (sum < 1) return <p className="text-xs text-destructive mt-1">Enter at least 1 item</p>;
                  if (sum > max) return <p className="text-xs text-destructive mt-1">Total ({sum}) exceeds available ({max})</p>;
                  return <p className="text-xs text-muted-foreground mt-1">Checking out {sum} item{sum !== 1 ? "s" : ""}</p>;
                })()}
              </div>
            </div>
            <div>
              <Label htmlFor="return-date">Expected Return Date</Label>
              <Input id="return-date" type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} placeholder="Any additional info..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCheckout}>Cancel</Button>
            <Button onClick={() => checkoutMutation.mutate({})} disabled={!borrowerName || !teamName || checkoutPin.length !== 4 || Object.values(checkoutConditionCounts).reduce((a, b) => a + b, 0) < 1 || Object.values(checkoutConditionCounts).reduce((a, b) => a + b, 0) > (checkoutItem?.quantity_available ?? 1) || checkoutMutation.isPending}>
              {checkoutMutation.isPending ? "Processing..." : "Confirm Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returnItem} onOpenChange={(open) => !open && resetReturn()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return: {returnItem?.name}</DialogTitle>
            <DialogDescription>
              Checked out by <span className="font-semibold">{returnBorrower}</span>{returnTeam ? <> on behalf of <span className="font-semibold">{returnTeam}</span></> : ""}. Enter your 4-digit PIN to return.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="return-pin">4-Digit PIN *</Label>
              <Input id="return-pin" value={returnPin} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setReturnPin(v); }} placeholder="Enter your PIN" inputMode="numeric" maxLength={4} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Returning up to <span className="font-semibold">{returnMaxQty}</span> item{returnMaxQty > 1 ? "s" : ""}. Specify condition for each:</p>
            </div>
            <div>
              <Label className="mb-2 block">Condition of Returned Items</Label>
              <div className="space-y-2 rounded-md border p-3">
                {(["excellent", "good", "fair", "bad", "damaged"] as const).map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <span className="w-24 text-sm capitalize">{c}</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-20"
                      value={returnConditionCounts[c] ?? 0}
                      onChange={(e) => {
                        let val = Math.max(0, parseInt(e.target.value) || 0);
                        if (val > returnMaxQty) val = 0;
                        setReturnConditionCounts({ ...returnConditionCounts, [c]: val });
                      }}
                    />
                  </div>
                ))}
                {(() => {
                  const sum = Object.values(returnConditionCounts).reduce((a, b) => a + b, 0);
                  if (sum < 1) return <p className="text-xs text-destructive mt-1">Enter at least 1 item to return</p>;
                  if (sum > returnMaxQty) return <p className="text-xs text-destructive mt-1">Total ({sum}) exceeds items checked out ({returnMaxQty})</p>;
                  return <p className="text-xs text-muted-foreground mt-1">Returning {sum} of {returnMaxQty} item{returnMaxQty > 1 ? "s" : ""}</p>;
                })()}
              </div>
            </div>
            <div>
              <Label htmlFor="return-notes">Notes</Label>
              <Textarea id="return-notes" value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Any issues or notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetReturn}>Cancel</Button>
            <Button onClick={() => returnMutation.mutate()} disabled={returnPin.length !== 4 || returnMutation.isPending || Object.values(returnConditionCounts).reduce((a, b) => a + b, 0) < 1 || Object.values(returnConditionCounts).reduce((a, b) => a + b, 0) > returnMaxQty}>
              {returnMutation.isPending ? "Processing..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Confirmation Dialog */}
      <Dialog open={showMergeConfirm} onOpenChange={(open) => { if (!open) { setShowMergeConfirm(false); setMergeTarget(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to existing checkout?</DialogTitle>
            <DialogDescription>
              You already have <span className="font-semibold">{mergeTarget?.quantity ?? 0}</span> of this item checked out. Would you like to add <span className="font-semibold">{Object.values(checkoutConditionCounts).reduce((a, b) => a + b, 0)}</span> more to that checkout?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMergeConfirm(false); setMergeTarget(null); }}>Cancel</Button>
            <Button onClick={() => { setShowMergeConfirm(false); checkoutMutation.mutate({ forceMerge: true }); }}>
              Yes, merge them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
