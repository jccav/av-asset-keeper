import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AdminHistory() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ["checkout-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_log")
        .select("*, equipment(name, category)")
        .order("checkout_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("checkout_log").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Log entry removed." });
      queryClient.invalidateQueries({ queryKey: ["checkout-history"] });
    }
  };

  const filtered = logs.filter((l: any) =>
    l.borrower_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.team_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.equipment?.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.contact_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.location_used?.toLowerCase().includes(search.toLowerCase()) ||
    l.av_member?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Checkout History</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, team, or equipment..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>On Behalf Of</TableHead>
                <TableHead>Contact #</TableHead>
                <TableHead>Location Used</TableHead>
                <TableHead>AV Member</TableHead>
                <TableHead>Qty Out</TableHead>
                <TableHead>Qty Returned</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Checkout Notes</TableHead>
                <TableHead>Return Notes</TableHead>
                <TableHead>Checked Out</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Returned By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.equipment?.name ?? "—"}</TableCell>
                  <TableCell>{log.borrower_name}</TableCell>
                  <TableCell>{log.team_name || "—"}</TableCell>
                  <TableCell>{log.contact_number || "—"}</TableCell>
                  <TableCell>{log.location_used || "—"}</TableCell>
                  <TableCell>{log.av_member || "—"}</TableCell>
                  <TableCell>{log.quantity ?? 1}</TableCell>
                  <TableCell>{log.quantity_returned ?? 0}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{log.pin ? "••••" : "—"}</code></TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.notes || ""}>{log.notes || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={log.return_notes || ""}>{log.return_notes || "—"}</TableCell>
                  <TableCell>{format(new Date(log.checkout_date), "MMM d, yyyy h:mm a")}</TableCell>
                  <TableCell>{log.return_date ? format(new Date(log.return_date), "MMM d, yyyy h:mm a") : "—"}</TableCell>
                  <TableCell>{log.returned_by || "—"}</TableCell>
                  <TableCell>
                    {log.return_date ? (
                      <Badge className="bg-success text-success-foreground">Returned</Badge>
                    ) : (log.quantity_returned ?? 0) > 0 ? (
                      <Badge className="bg-warning text-warning-foreground">Partially Returned</Badge>
                    ) : (
                      <Badge variant="secondary">Checked Out</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(!log.return_date && log.equipment) ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-40 cursor-not-allowed" disabled title="Cannot delete while item is checked out">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove this checkout record. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(log.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={16} className="py-8 text-center text-muted-foreground">No history found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
