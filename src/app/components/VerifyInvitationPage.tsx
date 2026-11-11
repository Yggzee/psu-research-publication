import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, Lock, Shield, User, Mail, Building, AlertCircle, Loader2, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuBookLogo from "../assets/psu-book-logo.svg";
import { apiService } from "../services/api.service";

export function VerifyInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get("token") || "").trim();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [superseded, setSuperseded] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userData, setUserData] = useState<{
    id?: string;
    name: string;
    instructorId: string;
    email: string;
    department: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No invitation token found in this link. Please check the email sent to you.");
      setLoading(false);
      return;
    }

    const checkToken = async () => {
      try {
        setLoading(true);
        const res: any = await apiService.verifyToken(token);
        if (res.valid && res.user) {
          setUserData(res.user);
        } else if (res.alreadyActive) {
          setAlreadyActive(true);
          if (res.user) setUserData(res.user);
        } else if (res.superseded) {
          setSuperseded(true);
          setError(res.error || "A newer invitation link was recently sent to your email.");
        } else {
          setError(res.error || "This invitation link is invalid or has expired.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to validate invitation token.");
      } finally {
        setLoading(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!password || password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setVerifying(true);
    try {
      const res: any = await apiService.completeInvitation(token, password);
      if (res.success) {
        setSuccess(true);
        if (res.user) setUserData(res.user);
      } else if (res.alreadyActive) {
        setAlreadyActive(true);
      } else {
        setFormError(res.message || res.error || "Failed to activate account.");
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while setting your password.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 sm:p-6 transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-6 select-none">
          <img src={psuBookLogo} alt="PSU Research Portal" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Pangasinan State University</h1>
            <p className="text-xs text-brand font-medium">Asingan Campus • Research Publication Tracking System</p>
          </div>
        </div>

        <Card className="shadow-2xl border-border bg-card">
          <CardHeader className="text-center pb-4 select-none">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand border border-brand/20 flex items-center justify-center mx-auto mb-2">
              {success || alreadyActive ? (
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              ) : (
                <Shield className="w-6 h-6" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {alreadyActive
                ? "Account Already Active"
                : success
                ? "Account Activated!"
                : "Complete Researcher Setup"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {alreadyActive
                ? "Your researcher profile is already verified and active."
                : success
                ? "Your email is verified and your preferred password is set."
                : "Verify your researcher invitation and set your private login password."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
                <p className="text-sm text-muted-foreground select-none">Validating invitation credentials...</p>
              </div>
            ) : alreadyActive ? (
              /* Already Activated State */
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Profile Verified & Ready</h3>
                  <p className="text-sm text-muted-foreground">
                    This account is already active. You can sign in right away using your Instructor ID (
                    <span className="font-mono text-brand font-bold">{userData?.instructorId}</span>) and your registered password.
                  </p>
                </div>
                <Button onClick={() => navigate("/login")} className="w-full bg-brand hover:bg-brand/90 text-white font-semibold">
                  Proceed to Sign In <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : superseded ? (
              /* Superseded Token State */
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-9 h-9" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Newer Invitation Dispatched</h3>
                  <p className="text-sm text-muted-foreground">
                    A more recent invitation link was sent to your email. Please check your inbox for the latest message from Campus Research Coordinator Sir Rodelio M. Garin.
                  </p>
                </div>
                <Button onClick={() => navigate("/login")} variant="outline" className="w-full border-border hover:bg-muted text-foreground">
                  Go to Sign In
                </Button>
              </div>
            ) : error ? (
              /* Generic Error State */
              <div className="py-4 space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-destructive select-none">Invitation Notice</h3>
                    <p className="text-xs text-destructive/90 mt-1 select-none">{error}</p>
                  </div>
                </div>
                <Button onClick={() => navigate("/login")} variant="outline" className="w-full border-border hover:bg-muted text-foreground">
                  Go to Sign In
                </Button>
              </div>
            ) : success ? (
              /* Success State */
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Welcome to the Research Community</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account is officially active. You can now sign in using your Instructor ID (
                    <span className="font-mono text-brand font-bold">{userData?.instructorId}</span>) and your new password.
                  </p>
                </div>
                <Button onClick={() => navigate("/login")} className="w-full bg-brand hover:bg-brand/90 text-white font-semibold">
                  Proceed to Sign In <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Researcher Verified Identity Badge */}
                {userData && (
                  <div className="bg-muted/60 border border-border rounded-lg p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                        <User className="w-4 h-4 text-brand" />
                        <span>{userData.name}</span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-bold">
                        {userData.instructorId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{userData.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/60">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 shrink-0" />
                        <span>{userData.department}</span>
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                        Official Researcher
                      </span>
                    </div>
                  </div>
                )}

                {/* Password Fields */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-foreground text-xs font-medium select-none">
                    Create New Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-surface border-border text-foreground placeholder:text-muted-foreground focus:ring-brand"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-foreground text-xs font-medium select-none">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 bg-surface border-border text-foreground placeholder:text-muted-foreground focus:ring-brand"
                      required
                    />
                  </div>
                </div>

                {formError && (
                  <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive font-medium">
                    {formError}
                  </div>
                )}

                <Button type="submit" disabled={verifying} className="w-full bg-brand hover:bg-brand/90 text-white font-semibold">
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Activating Account...
                    </>
                  ) : (
                    "Activate Account & Set Password"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
