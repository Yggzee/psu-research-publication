import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, Lock, Shield, User, Mail, Building, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import { apiService } from "../services/api.service";

export function VerifyInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const res = await apiService.verifyToken(token);
        if (res.valid && res.user) {
          setUserData(res.user);
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
      const res = await apiService.completeInvitation(token, password);
      if (res.success) {
        setSuccess(true);
      } else {
        setFormError(res.message || "Failed to activate account.");
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while setting your password.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={psuLogo} alt="PSU Logo" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Pangasinan State University</h1>
            <p className="text-xs text-blue-700 font-medium">Asingan Campus • Research & Publication System</p>
          </div>
        </div>

        <Card className="shadow-lg border-gray-200">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {success ? "Account Activated!" : "Complete Researcher Setup"}
            </CardTitle>
            <CardDescription className="text-sm">
              {success
                ? "Your email is verified and your preferred password is set."
                : "Verify your email invitation and set your personal password."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-500">Validating your invitation credentials...</p>
              </div>
            ) : error ? (
              <div className="py-6 space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-800">Invalid or Expired Link</h3>
                    <p className="text-xs text-red-700 mt-1">{error}</p>
                  </div>
                </div>
                <Button onClick={() => navigate("/login")} variant="outline" className="w-full">
                  Go to Sign In
                </Button>
              </div>
            ) : success ? (
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Welcome to the Research Community</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Your account is officially active. You can now sign in using your Instructor ID (
                    <span className="font-semibold text-gray-900">{userData?.instructorId}</span>) and your new password.
                  </p>
                </div>
                <Button onClick={() => navigate("/login")} className="w-full bg-blue-600 hover:bg-blue-700">
                  Proceed to Login <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Researcher Verified Identity Badge */}
                {userData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5 text-xs text-blue-900">
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-blue-950">
                      <User className="w-4 h-4 text-blue-600" />
                      {userData.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Mail className="w-3.5 h-3.5" />
                      {userData.email}
                    </div>
                    <div className="flex items-center justify-between text-gray-600 pt-1 border-t border-blue-100">
                      <span>ID: <strong className="text-blue-900">{userData.instructorId}</strong></span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {userData.department}
                      </span>
                    </div>
                  </div>
                )}

                {/* Password Fields */}
                <div className="space-y-2">
                  <Label htmlFor="password">Create New Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                {formError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 font-medium">
                    {formError}
                  </div>
                )}

                <Button type="submit" disabled={verifying} className="w-full bg-blue-600 hover:bg-blue-700">
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
