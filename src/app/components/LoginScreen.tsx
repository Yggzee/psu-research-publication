import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Building, GraduationCap, Link2, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import psuBuilding from "../../imports/psu_newbuilding.jpg";
import { getManagedResearchers, setCurrentUser } from "../utils/researchStore";
import { apiService } from "../services/api.service";

const DEPARTMENTS = ["BSIT", "BSBA", "BSE", "BEE", "BTLED", "BIT", "Non Teaching"];

export function LoginScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginStatusAlert, setLoginStatusAlert] = useState<{ status: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Self-Registration State
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regInstructorId, setRegInstructorId] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regDepartment, setRegDepartment] = useState("BSIT");
  const [regIsFaculty, setRegIsFaculty] = useState(true);
  const [regScholarUrl, setRegScholarUrl] = useState("");
  const [regNoScholar, setRegNoScholar] = useState(false);
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState<{
    email: string;
    message: string;
    verificationLink?: string;
  } | null>(null);

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginStatusAlert(null);
    setIsLoading(true);

    const inputId = email.trim();

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

        if (res.user.role === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/dashboard/search-engine");
        }
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

      if (instructor) {
        setCurrentUser({
          role: "instructor",
          instructorId: instructor.instructorId,
          name: instructor.name,
          department: instructor.department,
          isFaculty: instructor.isFaculty,
          photoUrl: instructor.photoUrl,
        });
        navigate("/dashboard/search-engine");
        return;
      }

      if (
        (inputId.toLowerCase() === "admin" || inputId.toLowerCase() === "admin@psu.edu.ph") &&
        password === "admin"
      ) {
        setCurrentUser({ role: "admin", name: "Administrator", username: "admin" });
        navigate("/dashboard");
        return;
      }

      setLoginError(err.message || "Invalid login. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regFirstName.trim() || !regLastName.trim() || !regInstructorId.trim() || !regEmail.trim()) {
      setRegError("First name, last name, Instructor ID, and email address are required.");
      return;
    }

    if (!regEmail.includes("@") || !regEmail.includes(".")) {
      setRegError("Please provide a valid email address (e.g. Gmail, Yahoo, or institutional email).");
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegError("Password must be at least 6 characters long.");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match.");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await apiService.register({
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        instructorId: regInstructorId.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment,
        isFaculty: regIsFaculty,
        scholarUrl: regNoScholar ? "" : regScholarUrl.trim(),
        hasScholar: !regNoScholar,
      });

      if (res.success) {
        setRegistrationSubmitted({
          email: res.email,
          message: res.message,
          verificationLink: res.verificationLink,
        });
      } else {
        setRegError(res.message || "Failed to submit registration.");
      }
    } catch (err: any) {
      setRegError(err.message || "An error occurred during registration. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  const resetRegisterForm = () => {
    setRegistrationSubmitted(null);
    setRegFirstName("");
    setRegLastName("");
    setRegInstructorId("");
    setRegEmail("");
    setRegDepartment("BSIT");
    setRegIsFaculty(true);
    setRegScholarUrl("");
    setRegNoScholar(false);
    setRegPassword("");
    setRegConfirmPassword("");
    setRegError("");
    setActiveTab("login");
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

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-gray-200/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setLoginError("");
                setLoginStatusAlert(null);
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setRegError("");
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Register as Researcher
            </button>
          </div>

          {/* MAIN CARD */}
          <Card className="shadow-lg border-gray-200 bg-white">
            <AnimatePresence mode="wait">
              {activeTab === "login" ? (
                /* ======================== SIGN IN FORM ======================== */
                <motion.div
                  key="login-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
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

                    {/* Notice */}
                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-500">
                        Default administrator: <span className="font-mono font-medium text-gray-700">admin / admin</span>
                      </p>
                    </div>
                  </CardContent>
                </motion.div>
              ) : registrationSubmitted ? (
                /* ======================== REGISTRATION CONFIRMATION ======================== */
                <motion.div
                  key="reg-confirmed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardHeader className="text-center pb-3">
                    <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">Registration Submitted!</CardTitle>
                    <CardDescription className="text-sm">
                      Step 1 of 2 Complete • Email Verification
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-2 leading-relaxed">
                      <p className="font-semibold text-sm text-blue-950 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-blue-600" />
                        Check Your Inbox
                      </p>
                      <p>
                        A verification link was dispatched to <strong>{registrationSubmitted.email}</strong>.
                      </p>
                      <p className="text-blue-800">
                        Please open that email and click the confirmation link to verify your email address. Once confirmed, your account will be presented to the Campus Research Administrator for final admission.
                      </p>
                    </div>

                    {/* Local dev helper button if running locally without real SMTP */}
                    {registrationSubmitted.verificationLink && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                        <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          Local Development / Testing Shortcut:
                        </p>
                        <p className="text-amber-800">
                          Since this is running locally, you can click directly to simulate opening the email link:
                        </p>
                        <a
                          href={registrationSubmitted.verificationLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white px-3 py-1.5 rounded border border-blue-200 shadow-sm"
                        >
                          Open Verification Link <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    <Button onClick={resetRegisterForm} variant="outline" className="w-full">
                      Return to Sign In
                    </Button>
                  </CardContent>
                </motion.div>
              ) : (
                /* ======================== REGISTRATION FORM ======================== */
                <motion.div
                  key="register-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-2xl font-bold text-gray-900">Researcher Registration</CardTitle>
                    <CardDescription className="text-sm">
                      Register your researcher profile. Once submitted, verify your email address for admin admission.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRegister} className="space-y-3.5">
                      {/* Name fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="regFirstName" className="text-xs font-medium">First Name</Label>
                          <Input
                            id="regFirstName"
                            placeholder="e.g. Rodelio"
                            value={regFirstName}
                            onChange={(e) => setRegFirstName(e.target.value)}
                            className="h-9 text-xs"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="regLastName" className="text-xs font-medium">Last Name</Label>
                          <Input
                            id="regLastName"
                            placeholder="e.g. Garin"
                            value={regLastName}
                            onChange={(e) => setRegLastName(e.target.value)}
                            className="h-9 text-xs"
                            required
                          />
                        </div>
                      </div>

                      {/* Instructor ID and Email */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="regInstructorId" className="text-xs font-medium">Instructor / Employee ID</Label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              id="regInstructorId"
                              placeholder="e.g. INS-2024-001"
                              value={regInstructorId}
                              onChange={(e) => setRegInstructorId(e.target.value)}
                              className="h-9 pl-8 text-xs"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="regEmail" className="text-xs font-medium">Email Address (Personal or Institutional)</Label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              id="regEmail"
                              type="email"
                              placeholder="e.g. yourname@gmail.com or @psu.edu.ph"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              className="h-9 pl-8 text-xs"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Department and Faculty Member Checkbox */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="space-y-1">
                          <Label htmlFor="regDepartment" className="text-xs font-medium">Department / Program</Label>
                          <Select value={regDepartment} onValueChange={setRegDepartment}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept} className="text-xs">
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="pt-4 flex items-center space-x-2">
                          <Checkbox
                            id="regIsFaculty"
                            checked={regIsFaculty}
                            onCheckedChange={(checked) => setRegIsFaculty(Boolean(checked))}
                          />
                          <Label htmlFor="regIsFaculty" className="text-xs font-medium cursor-pointer">
                            Teaching Faculty Member
                          </Label>
                        </div>
                      </div>

                      {/* Google Scholar Profile or None */}
                      <div className="space-y-1.5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Label htmlFor="regScholarUrl" className="text-xs font-medium flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          Google Scholar Profile Link
                        </Label>
                        <div className="relative">
                          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <Input
                            id="regScholarUrl"
                            type="url"
                            placeholder="https://scholar.google.com/citations?user=..."
                            value={regScholarUrl}
                            onChange={(e) => setRegScholarUrl(e.target.value)}
                            disabled={regNoScholar}
                            className="h-9 pl-8 text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                          <Checkbox
                            id="regNoScholar"
                            checked={regNoScholar}
                            onCheckedChange={(checked) => {
                              const val = Boolean(checked);
                              setRegNoScholar(val);
                              if (val) setRegScholarUrl("");
                            }}
                          />
                          <Label htmlFor="regNoScholar" className="text-xs text-gray-600 cursor-pointer">
                            I don't have a Google Scholar profile yet
                          </Label>
                        </div>
                      </div>

                      {/* Password and Confirm Password */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="regPassword" className="text-xs font-medium">Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              id="regPassword"
                              type="password"
                              placeholder="Min. 6 chars"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              className="h-9 pl-8 text-xs"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="regConfirmPassword" className="text-xs font-medium">Confirm Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              id="regConfirmPassword"
                              type="password"
                              placeholder="Re-type password"
                              value={regConfirmPassword}
                              onChange={(e) => setRegConfirmPassword(e.target.value)}
                              className="h-9 pl-8 text-xs"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {regError && (
                        <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-200">
                          {regError}
                        </p>
                      )}

                      {/* Register Button */}
                      <Button
                        type="submit"
                        disabled={isRegistering}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-semibold h-10 mt-2"
                      >
                        {isRegistering ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting Registration & Sending Email...
                          </>
                        ) : (
                          "Submit Registration & Verify Email"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
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
    </div>
  );
}
