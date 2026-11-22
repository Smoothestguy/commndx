import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, LogOut } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  status: string;
  expires_at: string;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/auth");
      return;
    }

    loadInvitation();
  }, [token, navigate]);

  useEffect(() => {
    if (user) {
      supabase.auth.getUser().then(({ data }) => {
        setUserEmail(data.user?.email || null);
      });
    }
  }, [user]);

  const loadInvitation = async () => {
    if (!token) return;

    try {
      const { data: rows, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
      if (error) {
        toast({
          title: "Invitation unavailable",
          description: "This invitation link is invalid, already used or expired. Please contact an administrator.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      const data = (rows as Invitation[] | null)?.[0];

      if (!data) {
        toast({
          title: "Invalid invitation",
          description: "This invitation link is invalid or has been removed.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (data.status !== "pending") {
        toast({
          title: "Invitation already used",
          description: "This invitation has already been accepted.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast({
          title: "Invitation expired",
          description: "This invitation has expired. Please contact an administrator.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setInvitation(data);
    } catch (error: any) {
      console.error("Error loading invitation:", error);
      toast({
        title: "Error",
        description: "Failed to load invitation details.",
        variant: "destructive",
      });
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAsExistingUser = async () => {
    if (!invitation || !user) return;

    setIsSubmitting(true);

    try {
      // Call the secure database function to accept the invitation
      const { data, error } = await supabase.rpc('accept_invitation', {
        _invitation_id: invitation.id,
        _user_id: user.id
      });

      if (error) throw error;

      // Log accepted event to activity log
      await supabase.from('invitation_activity_log').insert({
        invitation_id: invitation.id,
        action: 'accepted',
        performed_by: user.id,
        performed_by_email: userEmail,
        target_email: invitation.email,
        target_role: invitation.role,
        metadata: {
          accepted_at: new Date().toISOString(),
        },
      });

      // Notify the admin who sent the invitation
      try {
        await supabase.functions.invoke("notify-invitation-accepted", {
          body: {
            invitationId: invitation.id,
            newUserEmail: invitation.email,
            newUserName: userEmail || "User",
            role: invitation.role,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send notification to admin:", notifyError);
      }

      toast({
        title: "Invitation accepted!",
        description: `Your role has been updated to ${invitation.role}.`,
      });

      navigate(invitation.role === "customer_ops" ? "/customer-ops" : "/");
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error accepting invitation",
        description: error.message || "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setIsSubmitting(true);

    try {
      // Sign in with the invitation email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: loginPassword,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Failed to log in");
      }

      // After successful login, accept the invitation using secure function
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        _invitation_id: invitation.id,
        _user_id: data.user.id
      });

      if (acceptError) throw acceptError;

      // Log accepted event
      await supabase.from('invitation_activity_log').insert({
        invitation_id: invitation.id,
        action: 'accepted',
        performed_by: data.user.id,
        performed_by_email: data.user.email,
        target_email: invitation.email,
        target_role: invitation.role,
        metadata: {
          accepted_at: new Date().toISOString(),
        },
      });

      // Notify admin
      try {
        await supabase.functions.invoke("notify-invitation-accepted", {
          body: {
            invitationId: invitation.id,
            newUserEmail: invitation.email,
            newUserName: data.user.email || "User",
            role: invitation.role,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send notification to admin:", notifyError);
      }

      toast({
        title: "Invitation accepted!",
        description: `Welcome back! Your role has been updated to ${invitation.role}.`,
      });

      navigate(invitation.role === "customer_ops" ? "/customer-ops" : "/");
    } catch (error: any) {
      console.error("Error logging in:", error);
      toast({
        title: "Login failed",
        description: error.message || "Failed to log in. Please check your password.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Public sign-ups are disabled; the account is created server-side for this invitation only.
      const { data: result, error: fnError } = await supabase.functions.invoke("accept-invitation-signup", {
        body: { token, password, first_name: firstName, last_name: lastName },
      });
      if (fnError) {
        let message = fnError.message;
        let code: string | undefined;
        if (fnError instanceof FunctionsHttpError) {
          try {
            const body = await fnError.context.json();
            message = body?.error || message;
            code = body?.code;
          } catch { /* keep default message */ }
        }
        if (code === "user_exists") {
          toast({ title: "Account already exists", description: "Please use the 'Existing Account' tab to log in.", variant: "destructive" });
          return;
        }
        throw new Error(message);
      }
      if (!result?.success) throw new Error("Failed to create your account");

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invitation.email, password });
      if (signInError) {
        toast({ title: "Account created", description: "Please sign in with your new password." });
        navigate("/auth");
        return;
      }

      // Notify the admin who sent the invitation
      try {
        await supabase.functions.invoke("notify-invitation-accepted", {
          body: {
            invitationId: invitation.id,
            newUserEmail: invitation.email,
            newUserName: `${firstName} ${lastName}`,
            role: invitation.role,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send notification to admin:", notifyError);
        // Don't block the user signup if notification fails
      }

      toast({
        title: "Account created!",
        description: `Welcome to Fairfield! Your account has been created with ${invitation.role} role.`,
      });

      // Sign in will happen automatically via the auth state listener
      navigate(invitation.role === "customer_ops" ? "/customer-ops" : "/");
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error creating account",
        description: error.message || "Failed to create your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  // If logged in and email matches invitation
  if (user && userEmail === invitation.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-2xl font-bold text-primary">X</span>
              </div>
              <div>
                <CardTitle className="text-2xl">Accept Invitation</CardTitle>
                <CardDescription>Update your role</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">You've been invited as:</p>
              <p className="font-semibold text-lg capitalize">{invitation.role}</p>
              <p className="text-sm text-muted-foreground mt-2">{invitation.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              You're already logged in. Click below to accept this invitation and update your role.
            </p>
            <Button 
              onClick={handleAcceptAsExistingUser} 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Invitation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If logged in but email doesn't match invitation
  if (user && userEmail && userEmail !== invitation.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-2xl font-bold text-primary">X</span>
              </div>
              <div>
                <CardTitle className="text-2xl">Email Mismatch</CardTitle>
                <CardDescription>Wrong account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium mb-2">This invitation was sent to:</p>
              <p className="font-semibold">{invitation.email}</p>
              <p className="text-sm text-muted-foreground mt-3">But you're currently logged in as:</p>
              <p className="font-semibold">{userEmail}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Please log out and log in with the correct account to accept this invitation.
            </p>
            <Button 
              onClick={() => signOut()} 
              className="w-full"
              variant="outline"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in - show signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-2xl font-bold text-primary">X</span>
            </div>
            <div>
              <CardTitle className="text-2xl">Accept Invitation</CardTitle>
              <CardDescription>Create your Fairfield account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">You've been invited as:</p>
            <p className="font-semibold text-lg capitalize">{invitation.role}</p>
            <p className="text-sm text-muted-foreground mt-2">{invitation.email}</p>
          </div>

          <Tabs defaultValue="signup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">New Account</TabsTrigger>
              <TabsTrigger value="login">Existing Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleAcceptInvitation} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={invitation.email}
                      disabled
                      className="pl-9 bg-muted"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account & Accept Invitation
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLoginAndAccept} className="space-y-4">
                <div>
                  <Label htmlFor="loginEmail">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="loginEmail"
                      type="email"
                      value={invitation.email}
                      disabled
                      className="pl-9 bg-muted"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="loginPassword">Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="loginPassword"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log In & Accept Invitation
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
