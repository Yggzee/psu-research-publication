import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import { apiService } from "../services/api.service";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<{
    name?: string;
    email?: string;
    instructorId?: string;
    department?: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No email verification token provided in this link. Please check the email sent to you.");
      setLoading(false);
      return;
    }

    const runVerification = async () => {
      try {
        setLoading(true);
        const res = await apiService.verifyEmail(token);
        if (res.success) {
          setVerifiedUser(res.user || null);
        } else {
          setError(res.message || "Failed to verify email address.");
        }
      } catch (err: any) {
        setError(err.message || "Invalid or expired email verification link.");
      } finally {
        setLoading(false);
      }
    };

    runVerification();
  }, [token]);

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
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Email Verification
            </CardTitle>
            <CardDescription className="text-sm">
              Confirming your institutional researcher credentials
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm text-gray-500">Verifying your email address...</p>
              </div>
            ) : error ? (
              <div className="py-6 space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-800">Verification Issue</h3>
                    <p className="text-xs text-red-700 mt-1">{error}</p>
                  </div>
                </div>
                <Button onClick={() => navigate("/login")} variant="outline" className="w-full">
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-gray-900">Email Address Confirmed!</h3>
                  <p className="text-sm text-gray-600">
                    Thank you, <strong className="text-gray-900">{verifiedUser?.name || "Researcher"}</strong>. Your email address has been successfully verified.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-left text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-950">Next Step: Administrator Review</p>
                    <p className="mt-0.5 text-amber-800">
                      Your registration has been submitted to the Campus Research Administrator for review and admission. You will be able to log in once your account is admitted.
                    </p>
                  </div>
                </div>

                <Button onClick={() => navigate("/login")} className="w-full bg-blue-600 hover:bg-blue-700">
                  Return to Login <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
