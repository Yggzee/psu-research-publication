import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, useSearchParams, Navigate } from "react-router";
import { motion } from "motion/react";
import { Mail, Lock, User, CheckCircle2, AlertCircle, ArrowLeft, Loader2, Send, X, HelpCircle, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "../assets/psu-logo.png";
import psuBuilding from "../assets/psu_newbuilding.jpg";
import { setCurrentUser, getCurrentUser, getManagedResearchers } from "../utils/researchStore";
import { apiService } from "../services/api.service";
import { useTheme } from "../utils/themeContext";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect") || (location.state as any)?.from;

  // If already logged in, redirect away from login screen
  const currentUser = getCurrentUser();
  if (currentUser) {
    const destination = currentUser.role === "admin" ? "/dashboard" : "/dashboard/publications";
    return <Navigate to={destination} replace />;
  }

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginStatusAlert, setLoginStatusAlert] = useState<{ status: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ask for Invitation Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: "",
    lastName: "",
    middleInitial: "",
    email: "",
    instructorId: "",
    scholarUrl: "",
  });
  const [inviteError, setInviteError] = useState("");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteSubmitted, setInviteSubmitted] = useState(false);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  const handleRequestInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError("");

    if (!inviteForm.firstName.trim() || !inviteForm.lastName.trim() || !inviteForm.email.trim() || !inviteForm.instructorId.trim()) {
      setInviteError("First name, last name, email address, and Instructor ID are required.");
      return;
    }

    const digitsOnly = inviteForm.instructorId.replace(/\D/g, "");
    if (digitsOnly.length !== 5) {
      setInviteError("Instructor ID must be 5 digits (format: ASIN-00000).");
      return;
    }

    if (!inviteForm.email.includes("@") || !inviteForm.email.includes(".")) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await apiService.requestInvitation({
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        middleInitial: inviteForm.middleInitial.trim() || undefined,
        email: inviteForm.email.trim(),
        instructorId: `ASIN-${digitsOnly}`,
        scholarUrl: inviteForm.scholarUrl.trim() || undefined,
      });

      if (res.success) {
        setInviteSubmitted(true);
      } else {
        setInviteError(res.message || "Failed to submit invitation request.");
      }
    } catch (err: any) {
      setInviteError(err.message || "An error occurred while submitting your invitation request.");
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginStatusAlert(null);
    setIsLoading(true);

    const inputId = email.trim();

    const resolveTargetUrl = (role: "admin" | "instructor") => {
      if (redirectParam && redirectParam.startsWith("/dashboard")) {
        if (role === "instructor" && redirectParam.startsWith("/dashboard/admin")) {
          return "/dashboard/publications";
        }
        return redirectParam;
      }
      return role === "admin" ? "/dashboard" : "/dashboard/publications";
    };

    try {
      // 1. Try real SQLite Database authentication
      const res = await apiService.login(inputId, password);
      if (res && res.user) {
        setCurrentUser({
          id: res.user.id,
          role: res.user.role,
          name: res.user.name,
          username: res.user.username,
          instructorId: res.user.instructorId,
          department: res.user.department,
          isFaculty: res.user.isFaculty,
          photoUrl: res.user.photoUrl,
        }, res.token);

        navigate(resolveTargetUrl(res.user.role));
        return;
      }
    } catch (err: any) {
      console.warn("API login failed:", err);

      const errMessage = err.message || "";
      const cleanMessage = errMessage.replace(/^API Error: \d+ [^:]+:\s*/, "");

      // Check if server returned a 403 verification/approval status message
      if (
        errMessage.includes("pending email") ||
        errMessage.includes("verification") ||
        errMessage.includes("awaiting") ||
        errMessage.includes("approval") ||
        errMessage.includes("not approved")
      ) {
        setLoginStatusAlert({
          status: "pending",
          message: cleanMessage,
        });
        setIsLoading(false);
        return;
      }

      setLoginError(cleanMessage || "Invalid login. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-felt-canvas text-foreground transition-colors duration-200">
      {/* Left Side - Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-felt-canvas overflow-y-auto min-h-screen transition-colors duration-200">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg my-auto py-6"
        >
          {/* Navigation back to Public Search + Theme Toggle */}
          <div className="mb-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand hover:bg-brand/10 px-2.5 h-8 -ml-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Search</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="h-8 px-2.5 gap-1.5 text-xs font-medium bg-card border-border/80 text-muted-foreground hover:text-foreground"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </>
              )}
            </Button>
          </div>

          {/* Branding + Small ? Guide Button */}
          <div className="flex items-center gap-3 mb-6">
            <img 
              src={psuLogo} 
              alt="PSU Logo" 
              className="w-14 h-14 object-contain rounded-full shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl text-foreground font-bold leading-tight">Research Portal</h2>
                <button
                  type="button"
                  onClick={() => navigate("/guide")}
                  title="About & System Guide"
                  aria-label="Open About and System Guide"
                  className="w-6 h-6 rounded-full border border-border bg-card hover:bg-brand hover:text-white hover:border-brand text-muted-foreground transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-2xs"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium text-brand">PSU Asingan Campus</p>
            </div>
          </div>

          {/* MAIN SIGN IN CARD */}
          <Card className="shadow-lg border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-foreground">Welcome Back</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Sign in to monitor publications, claim scholarly publications, and analyze campus research.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Status Alert if account is pending */}
              {loginStatusAlert && (
                <div className="mb-4 p-3.5 bg-warning-soft border border-warning-border rounded-lg flex items-start gap-3 text-xs text-warning-foreground">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Account Status Notice</p>
                    <p className="mt-0.5 opacity-90 leading-relaxed">{loginStatusAlert.message}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email / Username Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">Username / Instructor ID</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="e.g. ASIN-00001 or username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10 text-sm"
                      required
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-xs text-danger-foreground font-medium bg-danger-soft p-2.5 rounded border border-danger-border" role="alert">
                    {loginError}
                  </p>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="w-full bg-brand hover:bg-brand/90 text-white text-sm font-semibold h-11"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In to System"
                  )}
                </Button>
              </form>

              {/* Researcher Onboarding & Invitation Request */}
              <div className="mt-6 pt-4 border-t border-border/70 space-y-3">
                <div className="text-left bg-muted/50 border border-border rounded-xl p-3.5 text-xs text-muted-foreground space-y-2.5">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand" />
                      Researcher Access
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Researcher accounts are provisioned by invitation. If you are a PSU researcher and have not yet been invited by Research Coordinator Sir Rodelio M. Garin, you can ask for an invitation.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInviteSubmitted(false);
                      setInviteError("");
                      setShowInviteModal(true);
                    }}
                    className="w-full gap-2 text-xs font-semibold border-brand/40 text-brand hover:bg-brand/10 bg-card h-9 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask for Invitation</span>
                  </Button>
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  Research Coordinator: <span className="font-mono font-medium text-foreground">psuac-rc / admin123</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Right Side - Background Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${psuBuilding})`,
        }}
      >
        <div className="absolute inset-0 bg-blue-900/65 dark:bg-slate-950/75 flex items-center justify-center p-12">
          <div className="text-white text-center max-w-lg space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Empowering Research Excellence
            </h1>
            <p className="text-base opacity-90 leading-relaxed">
              Track, analyze, and showcase Pangasinan State University research publications with comprehensive impact metrics, SDG alignments, and verified indexing.
            </p>
            <div className="pt-4 flex items-center justify-center gap-6 text-xs text-blue-200">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Institutional Verification
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Multi-Index Tracking
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Coordinator Moderation
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===================================================================== */}
      {/* ASK FOR INVITATION MODAL                                              */}
      {/* ===================================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card text-foreground rounded-2xl shadow-xl border border-border max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {!inviteSubmitted ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <Send className="w-4 h-4 text-brand" />
                      <span>Ask for System Invitation</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submit your credentials to request an invitation from Research Coordinator Sir Rodelio M. Garin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {inviteError && (
                  <p className="text-xs text-danger-foreground bg-danger-soft p-2.5 rounded-lg border border-danger-border">
                    {inviteError}
                  </p>
                )}

                <form onSubmit={handleRequestInvite} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="reqFirstName" className="text-xs font-semibold text-foreground">First Name *</Label>
                      <Input
                        id="reqFirstName"
                        value={inviteForm.firstName}
                        onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                        placeholder="e.g. Juan"
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="reqLastName" className="text-xs font-semibold text-foreground">Last Name *</Label>
                      <Input
                        id="reqLastName"
                        value={inviteForm.lastName}
                        onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                        placeholder="e.g. Dela Cruz"
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reqMiddleInitial" className="text-xs font-semibold text-foreground">Middle Initial</Label>
                    <Input
                      id="reqMiddleInitial"
                      value={inviteForm.middleInitial}
                      onChange={(e) => setInviteForm({ ...inviteForm, middleInitial: e.target.value })}
                      placeholder="e.g. M."
                      maxLength={5}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reqEmail" className="text-xs font-semibold text-foreground">Email Address *</Label>
                    <Input
                      id="reqEmail"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="e.g. jdelacruz@psu.edu.ph or personal email"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reqInstructorId" className="text-xs font-semibold text-foreground">Instructor ID *</Label>
                    <div className="flex items-center rounded-md border border-border bg-input-background focus-within:ring-2 focus-within:ring-brand/25 focus-within:border-brand overflow-hidden h-9">
                      <span className="px-3 h-full flex items-center bg-muted border-r border-border text-xs font-mono font-bold text-foreground select-none shrink-0">
                        ASIN-
                      </span>
                      <input
                        id="reqInstructorId"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{5}"
                        maxLength={5}
                        value={inviteForm.instructorId}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            instructorId: e.target.value.replace(/\D/g, "").slice(0, 5),
                          })
                        }
                        placeholder="00000"
                        className="w-full h-full px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground bg-transparent outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reqScholarUrl" className="text-xs font-semibold text-foreground">Google Scholar Link (If available)</Label>
                    <Input
                      id="reqScholarUrl"
                      type="url"
                      value={inviteForm.scholarUrl}
                      onChange={(e) => setInviteForm({ ...inviteForm, scholarUrl: e.target.value })}
                      placeholder="https://scholar.google.com/citations?user=..."
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/70">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInviteModal(false)}
                      className="h-9 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingInvite}
                      size="sm"
                      className="h-9 text-xs font-semibold bg-brand hover:bg-brand/90 text-white gap-1.5"
                    >
                      {isSubmittingInvite ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Invitation Request</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-foreground">Invitation Request Submitted!</h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Thank you! Your request has been forwarded to Research Coordinator Sir Rodelio M. Garin. Once approved, you will receive an official invitation link at <strong className="text-foreground">{inviteForm.email}</strong> to activate your researcher profile.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteSubmitted(false);
                    setInviteForm({
                      firstName: "",
                      lastName: "",
                      middleInitial: "",
                      email: "",
                      instructorId: "",
                      scholarUrl: "",
                    });
                  }}
                  className="h-9 text-xs bg-brand hover:bg-brand/90 text-white px-5 mt-2"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
