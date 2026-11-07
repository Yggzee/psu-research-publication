import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, useSearchParams, Navigate } from "react-router";
import { motion } from "motion/react";
import { Mail, Lock, User, CheckCircle2, AlertCircle, ArrowLeft, Loader2, Send, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "../assets/psu-logo.png";
import psuBuilding from "../assets/psu_newbuilding.jpg";
import { setCurrentUser, getCurrentUser } from "../utils/researchStore";
import { apiService } from "../services/api.service";

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
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
        instructorId: inviteForm.instructorId.trim(),
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

      // Check if server returned a 403 verification/approval status message
      const errMessage = err.message || "";
      if (
        errMessage.includes("pending email") ||
        errMessage.includes("verification") ||
        errMessage.includes("awaiting") ||
        errMessage.includes("approval") ||
        errMessage.includes("not approved")
      ) {
        setLoginStatusAlert({
          status: "pending",
          message: errMessage.replace(/^API Error: \d+ [^:]+:\s*/, ""),
        });
        setIsLoading(false);
        return;
      }

      // 2. Local Fallback for offline admin usage
      const instructor = getManagedResearchers().find(
        (member) =>
          (member.instructorId?.toLowerCase() === inputId.toLowerCase() ||
           member.name.toLowerCase() === inputId.toLowerCase() ||
           (member as any).email?.toLowerCase() === inputId.toLowerCase()) &&
          member.password === password,
      );

      if (
        (inputId.toLowerCase() === "psu-002" || inputId.toLowerCase() === "rodeliogarin@gmail.com") &&
        password === "123456"
      ) {
        setCurrentUser({
          role: "admin",
          instructorId: "PSU-002",
          name: "Sir Rodelio M. Garin",
          username: "PSU-002",
          email: "rodeliogarin@gmail.com",
          department: "Campus Research Unit / BSIT",
          isFaculty: true,
          photoUrl: "https://scholar.google.com/citations/images/avatar_scholar_128.png",
          scholarUrl: "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
          googleScholarId: "x6PdtN8AAAAJ",
        });
        navigate(resolveTargetUrl("admin"));
        return;
      }

      if (instructor) {
        setCurrentUser({
          role: "instructor",
          instructorId: instructor.instructorId,
          name: instructor.name,
          department: instructor.department,
          isFaculty: instructor.isFaculty,
          photoUrl: instructor.photoUrl,
        });
        navigate(resolveTargetUrl("instructor"));
        return;
      }

      if (
        (inputId.toLowerCase() === "admin" || inputId.toLowerCase() === "admin@psu.edu.ph") &&
        password === "admin"
      ) {
        setCurrentUser({
          role: "admin",
          name: "Sir Rodelio M. Garin",
          username: "admin",
          email: "admin@psu.edu.ph",
          department: "Campus Research Unit / BSIT",
          photoUrl: "https://scholar.google.com/citations/images/avatar_scholar_128.png",
          scholarUrl: "https://scholar.google.com/citations?user=x6PdtN8AAAAJ&hl=en",
          googleScholarId: "x6PdtN8AAAAJ",
        });
        navigate(resolveTargetUrl("admin"));
        return;
      }

      setLoginError(err.message || "Invalid login. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-slate-50 overflow-y-auto min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg my-auto py-6"
        >
          {/* Navigation back to Public Search (Single back button) */}
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 h-8 -ml-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Search</span>
            </Button>
          </div>

          {/* Branding */}
          <div className="flex items-center gap-3 mb-6">
            <img 
              src={psuLogo} 
              alt="PSU Logo" 
              className="w-14 h-14 object-contain shrink-0"
            />
            <div>
              <h2 className="text-2xl text-gray-900 font-bold leading-tight">Research Publication</h2>
              <p className="text-sm font-medium text-blue-700">Monitoring System • PSU Asingan Campus</p>
            </div>
          </div>

          {/* MAIN SIGN IN CARD */}
          <Card className="shadow-lg border-gray-200 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
              <CardDescription className="text-sm">
                Sign in to monitor publications, claim scholarly papers, and analyze campus research.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Status Alert if account is pending */}
              {loginStatusAlert && (
                <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-950">Account Status Notice</p>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">{loginStatusAlert.message}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email / Username Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Username / Instructor ID</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="e.g. INS-2024-001 or username"
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
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded border border-red-200" role="alert">
                    {loginError}
                  </p>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm font-semibold h-11"
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
              <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                <div className="text-left bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 space-y-2.5">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      Faculty & Researcher Access
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Researcher accounts are provisioned via administrator invitation. If you are a PSU researcher and have not yet been invited by Sir Rodelio M. Garin, you can ask for an invitation.
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
                    className="w-full gap-2 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50/80 bg-white h-9 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask for Invitation</span>
                  </Button>
                </div>

                <p className="text-[11px] text-center text-gray-400">
                  Default administrator: <span className="font-mono font-medium text-gray-600">admin / admin</span>
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
        <div className="absolute inset-0 bg-blue-900/65 flex items-center justify-center p-12">
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
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Admin Moderation
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===================================================================== */}
      {/* ASK FOR INVITATION MODAL                                              */}
      {/* ===================================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            {!inviteSubmitted ? (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-600" />
                      <span>Ask for System Invitation</span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Submit your credentials to request an invitation from Sir Rodelio M. Garin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {inviteError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {inviteError}
                  </p>
                )}

                <form onSubmit={handleRequestInvite} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="reqFirstName" className="text-xs font-semibold">First Name *</Label>
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
                      <Label htmlFor="reqLastName" className="text-xs font-semibold">Last Name *</Label>
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
                    <Label htmlFor="reqMiddleInitial" className="text-xs font-semibold">Middle Initial</Label>
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
                    <Label htmlFor="reqEmail" className="text-xs font-semibold">Email Address *</Label>
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
                    <Label htmlFor="reqInstructorId" className="text-xs font-semibold">Instructor / Employee ID *</Label>
                    <Input
                      id="reqInstructorId"
                      value={inviteForm.instructorId}
                      onChange={(e) => setInviteForm({ ...inviteForm, instructorId: e.target.value })}
                      placeholder="e.g. INS-2024-001"
                      className="h-9 text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reqScholarUrl" className="text-xs font-semibold">Google Scholar Link (If available)</Label>
                    <Input
                      id="reqScholarUrl"
                      type="url"
                      value={inviteForm.scholarUrl}
                      onChange={(e) => setInviteForm({ ...inviteForm, scholarUrl: e.target.value })}
                      placeholder="https://scholar.google.com/citations?user=..."
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
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
                      className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
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
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-gray-900">Invitation Request Submitted!</h4>
                <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                  Thank you! Your request has been forwarded to Campus Research Administrator Sir Rodelio M. Garin. Once approved, you will receive an official invitation link at <strong>{inviteForm.email}</strong> to activate your researcher profile.
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
                  className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white px-5 mt-2"
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
