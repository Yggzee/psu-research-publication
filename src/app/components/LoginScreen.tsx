import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Mail, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import psuLogo from "figma:asset/0f3e65de85ff26584e9a3039d47bcf17ff6e6368.png";
import psuBuilding from "../../imports/psu_newbuilding.jpg";
import { getManagedResearchers, setCurrentUser } from "../utils/researchStore";
import { apiService } from "../services/api.service";

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
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
        });

        if (res.user.role === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/dashboard/search-engine");
        }
        return;
      }
    } catch (err: any) {
      console.warn("API login failed, checking local credentials fallback:", err);
      // 2. Local Fallback for offline usage
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

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Branding */}
          <div className="flex items-center gap-3 mb-8">
            <img 
              src={psuLogo} 
              alt="PSU Logo" 
              className="w-16 h-16 object-contain"
            />
            <div>
              <h2 className="text-2xl text-gray-900 font-semibold">Research Publication</h2>
              <p className="text-base text-gray-600">Monitoring System</p>
            </div>
          </div>

          {/* Login Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Welcome Back</CardTitle>
              <CardDescription className="text-base">
                Sign in to access the Research Publication Monitoring System
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base">Username / Instructor ID</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter username or instructor ID"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10 md:text-base"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10 md:text-base"
                      required
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-sm text-red-600" role="alert">{loginError}</p>
                )}

                {/* Login Button */}
                <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-base">
                  Login
                </Button>
              </form>

              {/* Additional Info */}
              <div className="mt-6 text-center">
                <p className="text-base text-gray-600">
                  Pangasinan State University – Asingan Campus
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Default admin: admin / admin
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
        <div className="absolute inset-0 bg-blue-900/60 flex items-center justify-center p-12">
          <div className="text-white text-center">
            <h1 className="text-4xl mb-4">
              Empowering Research Excellence
            </h1>
            <p className="text-lg opacity-90">
              Track, analyze, and showcase research publications with comprehensive impact metrics
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
