import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Trash2, ArrowRightLeft, KeyRound } from "lucide-react";

export default function AdminAdmins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role, user } = useAuth();
  const isMaster = role === "master_admin";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const { data: admins = [] } = useQuery({
    queryKey: ["admin-list"],
    queryFn: async () => {
      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at");
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      // Fetch profiles for those user_ids
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);

      // Merge
      return roles.map((r) => {
        const profile = profiles?.find((p) => p.user_id === r.user_id);
        return { ...r, email: profile?.email ?? "Unknown", display_name: profile?.display_name };
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: { email: inviteEmail, password: invitePassword },
      });
      if (error) {
        // Try to extract meaningful error from the response
        const msg = data?.error || error.message || "Failed to invite admin";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast({ title: "Admin invited", description: `${inviteEmail} has been added as an admin.` });
      setInviteOpen(false);
      setInviteEmail("");
      setInvitePassword("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("remove-admin", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast({ title: "Admin removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: async (newMasterId: string) => {
      const { data, error } = await supabase.functions.invoke("transfer-master", {
        body: { new_master_id: newMasterId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast({ title: "Master Admin transferred" });
      setTransferTarget(null);
      window.location.reload();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("reset-admin-password", {
        body: { user_id: userId, new_password: resetPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "The admin's password has been updated." });
      setResetTarget(null);
      setResetPassword("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Admin Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setResetTarget(user?.id ?? null); }} className="gap-2">
            <KeyRound className="h-4 w-4" /> Reset My Password
          </Button>
          {isMaster && (
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite Admin
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Admin List</CardTitle>
          <CardDescription>All users with administrative access</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.email}</TableCell>
                  <TableCell>
                    {a.role === "master_admin" ? (
                      <Badge className="gap-1 bg-primary"><Shield className="h-3 w-3" /> Master Admin</Badge>
                    ) : (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isMaster && a.user_id !== user?.id && (
                        <>
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setResetTarget(a.user_id)}>
                            <KeyRound className="h-3 w-3" /> Reset Password
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setTransferTarget(a.user_id)}>
                            <ArrowRightLeft className="h-3 w-3" /> Transfer Master
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoveTarget(a.user_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {admins.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No admins found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
            <DialogDescription>Create a new admin account. They will be able to manage inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="newadmin@company.com" />
            </div>
            <div>
              <Label>Temporary Password *</Label>
              <Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail || !invitePassword || inviteMutation.isPending}>
              {inviteMutation.isPending ? "Inviting..." : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Confirmation */}
      <Dialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Master Admin</DialogTitle>
            <DialogDescription>Are you sure? You will lose master admin privileges and become a regular admin.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => transferTarget && transferMutation.mutate(transferTarget)} disabled={transferMutation.isPending}>
              {transferMutation.isPending ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Admin Access</DialogTitle>
            <DialogDescription>Are you sure you want to revoke this user's admin access? They will no longer be able to manage inventory or view admin pages.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (removeTarget) { removeMutation.mutate(removeTarget); setRemoveTarget(null); } }} disabled={removeMutation.isPending}>
              {removeMutation.isPending ? "Removing..." : "Yes, Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setResetPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Admin Password</DialogTitle>
            <DialogDescription>
              Set a new password for {admins.find((a: any) => a.user_id === resetTarget)?.email || "this admin"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Password *</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPassword(""); }}>Cancel</Button>
            <Button onClick={() => resetTarget && resetPasswordMutation.mutate(resetTarget)} disabled={!resetPassword || resetPassword.length < 8 || resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
