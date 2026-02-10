import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

export default function AdminHistory() {
  const [search, setSearch] = useState("");

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

  const filtered = logs.filter((l: any) =>
    l.borrower_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.team_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.equipment?.name?.toLowerCase().includes(search.toLowerCase())
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
                <TableHead>Team</TableHead>
                <TableHead>Checked Out</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.equipment?.name ?? "—"}</TableCell>
                  <TableCell>{log.borrower_name}</TableCell>
                  <TableCell>{log.team_name || "—"}</TableCell>
                  <TableCell>{format(new Date(log.checkout_date), "MMM d, yyyy h:mm a")}</TableCell>
                  <TableCell>{log.return_date ? format(new Date(log.return_date), "MMM d, yyyy h:mm a") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.return_date ? "default" : "secondary"}>
                      {log.return_date ? "Returned" : "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No history found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
