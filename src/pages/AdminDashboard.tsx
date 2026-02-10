import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, AlertTriangle, ArrowRightLeft, Archive } from "lucide-react";
import { format } from "date-fns";

export default function AdminDashboard() {
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

  const total = equipment.length;
  const available = equipment.filter((e) => e.is_available).length;
  const checkedOut = equipment.filter((e) => !e.is_available).length;
  const damaged = equipment.filter((e) => e.condition === "damaged").length;

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
              {activeCheckouts.map((c: any) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{c.equipment?.name ?? "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.borrower_name}{c.team_name ? ` · ${c.team_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Since {format(new Date(c.checkout_date), "MMM d, yyyy")}</p>
                    {c.expected_return && (
                      <Badge variant="outline" className="mt-1">
                        Due {format(new Date(c.expected_return), "MMM d")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
