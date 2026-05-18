import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      await api.post("/auth/login", { identifier, password });
      await checkAuth(); // Refresh the user context
      navigate("/dashboard");
    } catch (err: any) {
      if (!err.response) {
        setError("Service is currently unavailable. Please try again later.");
      } else if (err.response.status === 500) {
        setError("Service is currently unavailable. Please try again later.");
      } else if (err.response.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Invalid username/email or password.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl p-2">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">Welcome back</CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Enter your credentials to access your accountability dashboard
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="identifier"
            name="identifier"
            label="Email or username"
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com"
          />

          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error ? (
            <div className="flex items-center gap-2.5 p-3 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          ) : null}

          <Button
            type="submit"
            loading={isPending}
            className="w-full font-semibold"
          >
            Sign in
          </Button>

          <div className="text-center pt-2">
            <p className="text-xs text-zinc-400">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
