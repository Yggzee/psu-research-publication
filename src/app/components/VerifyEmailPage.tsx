import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuBookLogo from "../assets/psu-book-logo.svg";
import { apiService } from "../services/api.service";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get("token") || "").trim();

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
              <ShieldCheck className="w-6 h-6 text-brand" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Email Verification
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Confirming your institutional researcher credentials
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
                <p className="text-sm text-muted-foreground select-none">Verifying your email address...</p>
              </div>
            ) : error ? (
              <div className="py-4 space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-destructive select-none">Verification Notice</h3>
                    <p className="text-xs text-destructive/90 mt-1 select-none">{error}</p>
                  </div>
                </div>
                <Button onClick={() => navigate("/login")} variant="outline" className="w-full border-border hover:bg-muted text-foreground">
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <div className="py-4 space-y-5 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Email Address Confirmed!</h3>
                  <p className="text-sm text-muted-foreground">
                    Thank you, <strong className="text-foreground">{verifiedUser?.name || "Researcher"}</strong>. Your email address has been successfully verified.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 text-left text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Next Step: Research Coordinator Review</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Your verification has been submitted to Campus Research Coordinator Sir Rodelio M. Garin for review and admission. You will be notified once admitted.
                    </p>
                  </div>
                </div>

                <Button onClick={() => navigate("/login")} className="w-full bg-brand hover:bg-brand/90 text-white font-semibold">
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
