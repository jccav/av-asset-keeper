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
import { Search, Package, ArrowRightLeft, Settings } from "lucide-react";
import { Link } from "react-router-dom";
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
  good: "bg-success text-success-foreground",
  fair: "bg-warning text-warning-foreground",
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
  const [borrowerName, setBorrowerName] = useState("");
  const [checkoutPin, setCheckoutPin] = useState("");
  const [teamName, setTeamName] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [returnCondition, setReturnCondition] = useState<string>("good");
  const [returnNotes, setReturnNotes] = useState("");

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("is_retired", false)
        .order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!checkoutItem) return;
      const { error: logError } = await supabase.from("checkout_log").insert({
        equipment_id: checkoutItem.id,
        borrower_name: borrowerName,
        team_name: teamName || null,
        expected_return: expectedReturn || null,
        notes: checkoutNotes || null,
        pin: checkoutPin,
      });
      if (logError) throw logError;
      const { error: eqError } = await supabase
        .from("equipment")
        .update({ is_available: false })
        .eq("id", checkoutItem.id);
      if (eqError) throw eqError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Checked out!", description: `${checkoutItem?.name} has been signed out.` });
      resetCheckout();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returnItem) return;
      const { data: log, error: findError } = await supabase
        .from("checkout_log")
        .select("id, borrower_name, pin")
        .eq("equipment_id", returnItem.id)
        .is("return_date", null)
        .order("checkout_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      if (!log) throw new Error("No active checkout found.");
      if (returnPin.trim() !== log.pin) {
        throw new Error("Incorrect PIN. Please enter the 4-digit PIN used during checkout.");
      }
      const { error: logError } = await supabase
        .from("checkout_log")
        .update({
          return_date: new Date().toISOString(),
          condition_on_return: returnCondition as Equipment["condition"],
          notes: returnNotes || null,
        })
        .eq("id", log.id);
      if (logError) throw logError;
      const { error: eqError } = await supabase
        .from("equipment")
        .update({ is_available: true, condition: returnCondition as Equipment["condition"] })
        .eq("id", returnItem.id);
      if (eqError) throw eqError;
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
    setTeamName("");
    setExpectedReturn("");
    setCheckoutNotes("");
  };

  const resetReturn = () => {
    setReturnItem(null);
    setReturnBorrower("");
    setReturnTeam("");
    setReturnPin("");
    setTeamName("");
    setReturnCondition("good");
    setReturnNotes("");
  };

  const openReturn = async (item: Equipment) => {
    setReturnItem(item);
    // Fetch who checked it out
    const { data } = await supabase
      .from("checkout_log")
      .select("borrower_name, team_name")
      .eq("equipment_id", item.id)
      .is("return_date", null)
      .order("checkout_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setReturnBorrower(data?.borrower_name ?? "Unknown");
    setReturnTeam(data?.team_name ?? "");
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
            <Package className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">AV Equipment Tracker</h1>
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
            <Package className="mx-auto mb-4 h-12 w-12 opacity-40" />
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
                      className={item.is_available ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}
                    >
                      {item.is_available ? "Available" : "Checked Out"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                    <Badge className={CONDITION_COLORS[item.condition]}>
                      {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                    </Badge>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
                  )}
                  <div className="mt-2">
                    {item.is_available ? (
                      <Button className="w-full gap-2" onClick={() => setCheckoutItem(item)}>
                        <ArrowRightLeft className="h-4 w-4" /> Check Out
                      </Button>
                    ) : (
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out: {checkoutItem?.name}</DialogTitle>
            <DialogDescription>Fill in your details to sign out this equipment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="borrower">Your Name *</Label>
              <Input id="borrower" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="John Doe" />
            </div>
            <div>
              <Label htmlFor="pin">4-Digit PIN * <span className="text-xs text-muted-foreground">(you'll need this to return)</span></Label>
              <Input id="pin" value={checkoutPin} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCheckoutPin(v); }} placeholder="e.g. 1234" inputMode="numeric" maxLength={4} />
            </div>
            <div>
              <Label htmlFor="team">Who are you checking this out on behalf of? *</Label>
              <Input id="team" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Production Team, Pastor John, etc." />
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
            <Button onClick={() => checkoutMutation.mutate()} disabled={!borrowerName || !teamName || checkoutPin.length !== 4 || checkoutMutation.isPending}>
              {checkoutMutation.isPending ? "Processing..." : "Confirm Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returnItem} onOpenChange={(open) => !open && resetReturn()}>
        <DialogContent>
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
              <Label>Condition on Return</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="return-notes">Notes</Label>
              <Textarea id="return-notes" value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Any issues or notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetReturn}>Cancel</Button>
            <Button onClick={() => returnMutation.mutate()} disabled={returnPin.length !== 4 || returnMutation.isPending}>
              {returnMutation.isPending ? "Processing..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
